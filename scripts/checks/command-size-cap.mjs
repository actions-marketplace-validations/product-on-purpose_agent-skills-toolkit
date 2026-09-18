// what-it-is:   U18 - a commands/*.md that Codex will silently DROP when it migrates commands into skills
// what-it-does: warns when a command file is at or over the vendor's migration size cap on a plugin that
//               declares codex as an agent-target
// why:          Codex migrates a plugin's commands/*.md into skills, and a command whose rendered skill
//               exceeds the cap is SKIPPED - no SKILL.md is written, no error is raised, and the command
//               simply does not exist on Codex. The author's plugin is smaller than they think it is and
//               nothing anywhere says so. This is the one vendor behaviour in the spine that removes a
//               shipped component without a trace
// used-by:      scripts/lib/registry.mjs (the CHECKS array); covered by tests/unit/command-size-cap.test.mjs
import path from "node:path";
import { finding, SEVERITY } from "../lib/findings.mjs";

/**
 * THE VENDOR FACT, and what it actually says.
 *
 * `openai/codex`, `codex-rs/core-plugins/src/command_migration/plugin.rs` line 17, read 2026-09-05 at
 * commit `52e73e3a548ae5310c7765995b9803dd538b82b0`:
 *
 *     const MAX_MIGRATED_COMMAND_SKILL_BYTES: usize = 4_000;
 *
 * and `codex-rs/core-plugins/src/command_migration.rs` lines 165-169, the enforcement:
 *
 *     if let CommandSkillSizeLimit::MaxBytes(max_bytes) = size_limit
 *         && rendered.len() > max_bytes
 *     { continue; }
 *
 * **`continue`, not truncate.** The resolution plan's RS-C3 row described this as "silent truncation /
 * degradation of the migrated skill"; the source says the loop moves to the next command and never writes
 * `SKILL.md` at all. Those are materially different consequences - a truncated skill is a degraded one
 * that still exists and can be found by a reader wondering why it stops mid-sentence, while a skipped one
 * is absent, and absence has no symptom. The message below states the behaviour the source has, not the
 * behaviour the plan expected.
 *
 * @see docs/internal/decisions/0058-a-vendor-that-drops-a-component-is-a-finding-and-the-proxy-is-declared.md
 */
export const CODEX_COMMAND_SKILL_MAX_BYTES = 4000;

/**
 * WHAT THE CAP MEASURES, and why this check measures something slightly different.
 *
 * The vendor caps `rendered.len()` - the migrated SKILL.md after `render_command_skill()` has stripped the
 * command's own frontmatter and written skill frontmatter (`name`, `description`) in its place. This check
 * measures the raw `commands/*.md` byte length, which is a PROXY, and the difference runs in both
 * directions: the source frontmatter comes off (raw over-reads) and generated skill frontmatter goes on
 * (raw under-reads).
 *
 * The proxy is declared rather than hidden, in the docblock, in the finding message and in ADR 0058,
 * because the alternative is worse. Reproducing `render_command_skill` would couple a house check to the
 * internals of a vendor's Rust renderer, which is a private function this project cannot pin, cannot
 * observe from outside, and would silently diverge from at the vendor's next refactor - the
 * `vendor-watch` ledger has no instrument for "a function still renders the way we assumed".
 *
 * The proxy is honest at WARN severity and would not be at error severity, which is the other half of why
 * this ships capped. A warn says "this is at risk and you should check"; an error would be asserting a
 * fact about the rendered output that this check did not measure.
 */
const NEAR_CAP_NOTE =
  "the cap applies to the RENDERED skill (your frontmatter is replaced by generated skill frontmatter), so this raw size is a close proxy rather than an exact measure";

/**
 * NO MIGRATION METADATA, DELIBERATELY. `U18` IS PERMANENTLY `warn` AND DOES NOT GRADUATE.
 *
 * It shipped in v1.19.0 carrying `capAt: "warn", until: "0.17"` and a reason reading "...and gates at
 * 0.17". That was FALSE and is removed here rather than left as a record, because it was never a record
 * of anything - it described a graduation that could not happen.
 *
 * WHY IT COULD NOT HAPPEN, measured rather than argued. This check emits `SEVERITY.WARN` natively (see
 * the finding below). A cap of `warn` over a finding that is ALREADY `warn` is a no-op: when the window
 * closed at 0.17 the severity would have stayed exactly where it was. Demonstrated against a fixture
 * with an oversized command, with `G2` in the same run as a positive control:
 *
 *     pin 0.16   U18 warn    G2 warn   (G2 held down by its own cap)
 *     pin 0.17   U18 warn    G2 error  (G2 graduates; U18 does not move)
 *
 * `G1`, `G2` and `G8` all emit `SEVERITY.ERROR` natively and are capped DOWN to warn, so their caps do
 * real work and they genuinely graduate at 0.17. `U18` was the odd one out.
 *
 * AND IT SHOULD NOT GRADUATE, which is why the fix is to delete the cap rather than to raise the
 * severity. [ADR 0058] made this check `warn` on purpose: it measures the SOURCE file while the vendor
 * caps the RENDERED skill, so the measurement is a declared proxy. Its own words - "a warn says 'at
 * risk, go and check'; an error would assert a fact about rendered output the check never measured".
 * The migration metadata contradicted the ADR that created the check.
 *
 * DELETING AN INERT CAP IS SAFE, AND THAT IS NOT THE GENERAL RULE. Expired caps elsewhere in this tree
 * are deliberately left in place, because removing one red-lines every plugin still pinned below its
 * version. That rule protects caps that DO something. This one changed no severity at any pin, which is
 * measurable and was measured, twice and at different scopes. (1) The fixture above at both pins, with
 * `G2` as a positive control, so "U18 did not move" is distinguishable from "caps do not work here".
 * (2) The reference family: `evaluate ../agent-plugins --scope marketplace` before and after, 6 of 6
 * members graded, output BYTE-IDENTICAL - same 3 collection errors, 0 collection warnings, verdict RED
 * both times.
 *
 * `since: "0.16"` stays. It is not a migration window - it stops the check reaching a plugin pinned
 * below the revision that introduced it, which is a real and still-necessary job.
 */

/**
 * `vendor-cited` provenance rather than `objective`. A byte count IS objective, but the 4000 is not this
 * project's number and the threshold is the whole content of the check: it is quoted from a named file at
 * a named commit, and it moves when the vendor moves it.
 */
export const meta = {
  id: "command-size-cap",
  tier: "universal",
  reqId: "U18",
  since: "0.16",
  provenance: "vendor-cited",
};

/**
 * U18: on a plugin that declares `codex` as an agent-target, every `commands/*.md` SHOULD stay under the
 * size at which Codex's command migration drops it.
 *
 * Scoped to declared Codex targets deliberately. A Claude-only plugin's commands are never run through
 * this migration, so a large command there is not a defect of any kind and reporting one would be the
 * house grading a plugin against a convention it never adopted, which is the principle ADR 0029 settled
 * for house-provenance checks and ADR 0058 applies here by scoping. The signal is `library.json`'s
 * `agent-targets`, matching `per-target-presence`, because that is the author's STATED intent rather than
 * an artifact that may or may not have been regenerated.
 *
 * Vacuous with no library.json (U1 owns that), with no or invalid `agent-targets` (S1 owns that), with
 * codex not among the targets, and on a plugin that ships no commands.
 */
export function check(ctx) {
  const lib = ctx.library?.data;
  if (!lib) return []; // U1 owns missing library.json
  const targets = lib["agent-targets"];
  if (!Array.isArray(targets) || !targets.includes("codex")) return []; // S1 owns missing/invalid agent-targets

  const out = [];
  for (const cmd of ctx.commands || []) {
    // `raw` is null only when the file could not be read, which the command-shape checks own.
    if (typeof cmd.raw !== "string") continue;
    const bytes = Buffer.byteLength(cmd.raw, "utf8");
    if (bytes <= CODEX_COMMAND_SKILL_MAX_BYTES) continue;
    const rel = path.relative(ctx.root, cmd.file).split(path.sep).join("/");
    out.push(
      finding(
        meta.id,
        SEVERITY.WARN,
        `command "${rel}" is ${bytes} bytes, over the ${CODEX_COMMAND_SKILL_MAX_BYTES}-byte cap Codex applies when it migrates commands into skills. Codex SKIPS an oversized command rather than truncating it: no skill is written, no error is raised, and the command does not exist on Codex at all. Note that ${NEAR_CAP_NOTE}. Split the command, or move the bulk of it into a skill the command points at.`,
        { file: rel, reqId: meta.reqId }
      )
    );
  }
  return out;
}
