#!/usr/bin/env node
// what-it-is:   the guard for THIS repository's own generated resolved manifest - the one generated
//               artifact in the tree that nothing compared against its source
// what-it-does: re-derives manifest.generated.json from library.json plus on-disk component frontmatter
//               using the shipped generator, and requires the committed file to equal it. Reports the
//               four spine fields (name, version, tier, standard) against library.json DIRECTLY first,
//               because those are the ones a release reads, then the first line where the committed
//               file and the re-derived one diverge.
// why:          measured on main at 3ee7170 on 2026-09-19. Setting manifest.generated.json's `version`
//               to 9.9.9 and its `standard` to 0.01 while library.json read 1.19.0 and 0.16 left
//               `node scripts/check.mjs .` at "Tier: Advanced, 0 error(s), 0 warning(s)" AND the whole
//               suite at 1659 tests / 1655 pass / 0 fail. The file is generated, tracked, and named in
//               INDEX.md as the agent index, and it was the only generated artifact in this tree with
//               NO guard at all - each of the others was measured on 2026-09-19 rather than assumed.
//               INDEX.md: hand-editing its first heading moves the gate from "Advanced, 0 errors" to
//               "Convergent, 1 error" naming `index-drift` (`G4`), which regenerates and compares the
//               whole document. The two NATIVE manifests: `U8` (manifest-drift) compares them against
//               library.json, though only on `name` and `version` - its own docblock says so, and it
//               never reads this file. docs/reference/standard-coverage.md: gen-standard-coverage
//               without `--write` is its drift mode and exits 0 on the clean tree. AGENTS.md is the
//               one that does NOT belong on that list and an earlier draft of this block put it there:
//               sync-agents-md emits a `<!-- generated:components -->` block, and this repository's
//               AGENTS.md contains ZERO occurrences of that marker, so nothing here is generated into
//               it and there is nothing to drift-check. The `U8`/`G4` docblocks used to imply this file
//               was covered; PR #334 (checks state what they measure) corrected that text, which made
//               it honestly documented as ungoverned without governing it.
// used-by:      npm test, npm run self-consistency, tests/unit/self-consistency.test.mjs
// scope:        DELIBERATELY WIDER THAN THE MEASURED HOLE, and the widening is a decision rather than
//               an accident. The hole was two spine fields; the guard compares the whole generated
//               document, so a skill or command description that drifted from its frontmatter, a
//               component added to library.json without regenerating, and an mcpServers entry are all
//               caught too. That is affordable precisely because the file is GENERATED: the invariant
//               is not "these fields agree" but "this file is what the generator produces", which is
//               the same invariant `U8` asserts for the native manifests, and the repair is always the
//               one command the failure message prints.
// not-here:     COMPONENT VERSIONS ARE DELIBERATELY NOT CHECKED HERE, and this paragraph exists so the
//               next person does not re-find a non-hole. tests/unit/component-version-mirror.test.mjs
//               already compares every `components` entry's declared version in library.json against
//               that component's own frontmatter, runs in `npm test`, and was measured on 2026-09-19 to
//               fail on a drifted SKILL (1 failure) and on a drifted skill, subagent and command
//               together (3 failures, all three named in the message). It also fails rather than skips
//               when a component's frontmatter version cannot be read, and carries a non-vacuity test.
//               What is uncovered on that surface is the GATE - `S3` (components-index) matches by name
//               only, so a third-party plugin's grade does not move on a version drift - and `S3` is a
//               SPINE check that this change is forbidden to tighten. A second implementation here
//               would be surface area, not coverage.
// known-limits: this compares the resolved manifest against the generator's output, so a defect IN the
//               generator is invisible: if gen-manifest started emitting a wrong field and the file were
//               regenerated, both sides would move together and this would stay green. That is the same
//               blind spot every regenerate-and-compare drift guard in this tree has, named rather than
//               implied. It also says nothing about the two NATIVE manifests - `U8` owns those - and it
//               reads only the committed file, so a manifest that is absent is reported as an error
//               rather than passed, since the file is tracked.
// not-a-check:  a HOUSE guard over this repository's own records. It has no reqId, is not registered in
//               scripts/lib/registry.mjs, and no plugin's grade moves because of it - measured before and
//               after: `node scripts/check.mjs .` reports Tier Advanced, 0 errors, 0 warnings both ways.
//               It lives beside check-claim-citations, check-doc-enumerations and check-stale-state.

import fs from "node:fs";
import path from "node:path";

import { renderManifest } from "./generators/gen-manifest.mjs";
import { loadPlugin } from "./lib/load-plugin.mjs";

/** The generated resolved manifest, relative to a plugin root. */
export const RESOLVED_MANIFEST = "manifest.generated.json";

/**
 * The fields manifest.generated.json copies verbatim out of library.json. Compared DIRECTLY against
 * library.json rather than only through the generator, so the measured hole is closed by a comparison
 * a reader can verify by eye against two files, with no generator in the path.
 */
export const SPINE_FIELDS = ["name", "version", "tier", "standard"];

/**
 * This repository is stored CRLF; the generator emits LF. Measured 2026-09-19 at 3ee7170: the committed
 * file is 11799 bytes CRLF, the generator's output 11647 characters LF, and they are identical once
 * normalized. A byte comparison would therefore red on every Windows checkout - a guard that fails when
 * nothing is wrong teaches people to ignore it.
 */
export const normalizeEol = (s) => s.replace(/\r\n/g, "\n");

/**
 * The first line on which two documents diverge, one-based, or null when they are equal. Pure and
 * exported so the comparison can be tested on strings without a plugin tree, the same split
 * check-stale-state makes with `claimsOnLine`.
 */
export function firstDivergence(committed, generated) {
  const a = normalizeEol(committed).split("\n");
  const b = normalizeEol(generated).split("\n");
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) return { line: i + 1, committed: lineLabel(a, i), generated: lineLabel(b, i) };
  }
  return null;
}

/**
 * How a position is described in the failure message. Neither array is trimmed before comparing, so a
 * generated file that lost or gained its final newline is still a divergence rather than a silent pass -
 * but that makes two positions that are not really lines, and an earlier draft printed both as an empty
 * string. A test caught that: it is the difference between "the file stops before this line" and "the
 * file stops here, after its final newline", and a reader needs to be told which.
 */
function lineLabel(lines, i) {
  if (i >= lines.length) return "(the file ends before this line)";
  if (i === lines.length - 1 && lines[i] === "") return "(the file ends here, after a final newline)";
  return lines[i];
}

/**
 * Spine fields of the committed manifest that disagree with library.json. Pure over two parsed objects
 * so a test can drive it without a tree. A field MISSING from the manifest is a disagreement, not a
 * skip: the generator always emits all four (it writes null when library.json has no value), so an
 * absent key means the file was hand-edited.
 */
export function spineDisagreements(manifest, library) {
  const out = [];
  for (const k of SPINE_FIELDS) {
    const got = manifest?.[k] ?? null;
    const want = library?.[k] ?? null;
    if (got !== want) out.push({ field: k, manifest: got, library: want });
  }
  return out;
}

/**
 * The whole guard over one plugin root. Returns `{ error, spine, divergence }`; `error` is set only when
 * the comparison could not be PERFORMED, which is distinct from the comparison finding a disagreement.
 */
export function findSelfInconsistency(root = ".") {
  const manifestPath = path.join(root, RESOLVED_MANIFEST);
  const libraryPath = path.join(root, "library.json");
  if (!fs.existsSync(libraryPath)) {
    return { error: `no library.json at ${libraryPath}; nothing to compare the manifest against`, spine: [], divergence: null };
  }
  if (!fs.existsSync(manifestPath)) {
    return {
      error: `${RESOLVED_MANIFEST} is missing at ${manifestPath}; it is a tracked generated artifact, ` +
        `so its absence is a defect rather than an exemption`,
      spine: [],
      divergence: null,
    };
  }

  const committed = fs.readFileSync(manifestPath, "utf8");
  const library = JSON.parse(fs.readFileSync(libraryPath, "utf8"));

  let manifest = null;
  try {
    manifest = JSON.parse(committed);
  } catch (e) {
    return { error: `${RESOLVED_MANIFEST} is not valid JSON: ${e.message}`, spine: [], divergence: null };
  }

  const spine = spineDisagreements(manifest, library);

  let generated;
  try {
    generated = renderManifest(loadPlugin(root));
  } catch (e) {
    return { error: `could not re-derive ${RESOLVED_MANIFEST}: ${e.message}`, spine, divergence: null };
  }

  return { error: null, spine, divergence: firstDivergence(committed, generated) };
}

const REGEN = "node scripts/generators/gen-manifest.mjs . --write --target=resolved";

function main() {
  const root = process.argv[2] ?? ".";
  const { error, spine, divergence } = findSelfInconsistency(root);
  if (error) {
    console.error(`check-self-consistency: ${error}`);
    process.exit(1);
  }
  if (spine.length === 0 && divergence === null) {
    console.log(
      `OK check-self-consistency: ${RESOLVED_MANIFEST} agrees with library.json on all ` +
        `${SPINE_FIELDS.length} spine field(s) and matches the generator's output line for line ` +
        `(line endings normalized before comparing).`,
    );
    return;
  }
  console.error(`check-self-consistency: ${RESOLVED_MANIFEST} does not match what generates it.\n`);
  for (const d of spine) {
    console.error(
      `  ${RESOLVED_MANIFEST} "${d.field}" is ${JSON.stringify(d.manifest)}, ` +
        `but library.json "${d.field}" is ${JSON.stringify(d.library)}`,
    );
  }
  if (divergence) {
    console.error(
      `  ${RESOLVED_MANIFEST}:${divergence.line} differs from the generator's output\n` +
        `      committed: ${divergence.committed.trim()}\n` +
        `      generated: ${divergence.generated.trim()}`,
    );
  }
  console.error(
    `\n${RESOLVED_MANIFEST} is generated from library.json plus component frontmatter. Either the source\n` +
      `moved and the file was not regenerated - run: ${REGEN}\n` +
      `- or the file was hand-edited, in which case put the change in library.json and regenerate.`,
  );
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("check-self-consistency.mjs")) {
  main();
}
