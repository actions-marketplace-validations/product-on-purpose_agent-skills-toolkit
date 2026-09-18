#!/usr/bin/env node
// what-it-is:   the guard for a WIRING claim: prose in this repository asserting that one of its own
//               house scripts runs inside a named npm script
// what-it-does: in the governed live-state and public docs, finds every sentence that binds a list of
//               backticked script names to `npm test` (or `npm run <name>`) with a positive wiring
//               verb, and requires each named script to actually appear in that npm script's resolved
//               command chain in package.json
// why:          docs/internal/backlog/enhancements.md:716 argued that `action-pin-watch` is uniquely
//               exposed because it is a release-time gate, and closed with "Every other claim guard in
//               this repository - `check-doc-enumerations`, `check-readme-version`,
//               `check-claim-citations`, `check-release-counts` - runs in `npm test` and therefore on
//               every pull request." Three of those four are true. `check-release-counts` is a
//               `release-ready` gate (scripts/lib/release-ready.mjs), which is the SAME release-time
//               side of the contrast the sentence was drawing - so the entry's own argument understated
//               its hole by half while reading as a careful measurement. The claim was never true at any
//               commit: `git log -p -- package.json` shows the `test` script has only ever gained
//               check-readme-version, check-doc-enumerations and check-claim-citations. It is also
//               structurally impossible, because check-release-counts SPAWNS `node --test` to read the
//               suite total, so running it from inside `npm test` would recurse. Nothing could catch it:
//               check-release-counts polices a stale NUMBER and check-doc-enumerations a stale SPINE
//               COUNT, while this is a stale statement about the repository's own wiring.
// used-by:      npm test, tests/unit/stale-state.test.mjs
// scoop-design: the trigger scoops EVERY backticked script token in the claim's subject list, not the
//               one adjacent to the verb. That is check-claim-citations' recorded lesson applied
//               verbatim: its first design keyed off the words immediately preceding the token and
//               caught one defect in four. Here the false name sits THIRD in a four-item list, so an
//               adjacency rule would have read `check-claim-citations` (true) and passed.
//               A path-existence design was built and measured FIRST, per the task that commissioned
//               this file, and REJECTED on evidence rather than taste. Two independent results killed
//               it. (1) Swept over every tracked `.md`, an absence predicate bound to a backticked
//               tracked path returned 9 hits and 0 genuine ones; the mirror direction (a repo-rooted
//               path named as present but not tracked) returned 26 in the live-state docs and 23 in the
//               public docs, again 0 genuine. Every hit fell into one of six classes a line-local
//               trigger cannot see: a conditional ("Copy `templates/mcp.json` if the file does not
//               exist"), a different grammatical subject ("the constant this ADR added to `X` was
//               REMOVED"), a path in the READER'S plugin (`.claude-plugin/marketplace.json`,
//               `skills/summarize-meeting-notes/`), a path in another repository
//               (`docs/specification.mdx` is agentskills.io's), correct past tense ("it used to live
//               at `X`"), and planned work whose future tense is established three lines earlier under
//               a heading the line does not carry (STATUS.md:647's `docs/adoption/`). (2) Decisively,
//               it would not have fired on its own motivating defect: at 6aa894b the roadmap rows read
//               "| `01-potemkin-gold` - ... | **NOT extracted.**", and `01-potemkin-gold` is a fixture
//               LABEL with no slash in it, not a repo path - this repository already registers
//               `09-pin-abuse` in check-claim-citations' KNOWN_NON_CLAIM as "a corpus fixture
//               directory ... not a ledger claim". Resolving that label to
//               tests/fixtures/audit-corpus/potemkin-gold/ requires guessing that a numeric prefix
//               strips and that a basename maps to a fixture directory, which is the guess the task
//               forbade. A guard that cannot fire on the defect that commissioned it is surface area.
// known-limits: a wiring claim made with a pronoun ("It is wired into `npm test`") carries no token and
//               is invisible here - deliberately, since resolving the pronoun is the guess this file
//               refuses to make. So is a claim spelled with a verb outside WIRING_VERB. History is
//               exempt (see HISTORY): CHANGELOG.md, RELEASE-NOTES.md, RELEASE-HISTORY.md, the release
//               packets and the execution plan correctly state the wiring of their own day, as do
//               blockquoted version notes. A NEGATED claim is skipped rather than checked, because
//               "`X` does not run in `npm test`" is the shape the repair for a finding here is written
//               in, and a guard that fires on the prose explaining its own finding is the recorded
//               failure this repository has already had once.
// not-a-check:  report-only over documents, exits 1 on a false wiring claim. Deliberately NOT a
//               Standard spine check - it polices THIS repository's records rather than a graded
//               plugin's shape, so it lives beside check-claim-citations and check-doc-enumerations.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

/**
 * Documents that correctly state the wiring of their own day. A release packet, an ADR and a changelog
 * section are dated records; policing them would force an edit to a shipped document every time the
 * wiring changed. Same convention check-doc-enumerations uses for stale spine counts.
 */
const HISTORY_FILES = new Set(["CHANGELOG.md", "RELEASE-NOTES.md", "docs/internal/RELEASE-HISTORY.md"]);
const HISTORY_DIRS = [
  "docs/internal/release-plans/",
  "docs/internal/execution/",
  "docs/internal/decisions/",
  "tests/",
];
const isHistoryLine = (line) => line.trimStart().startsWith(">");

/**
 * Script names that appear in a wiring claim's subject list and are NOT one of this repository's own
 * runnable scripts. Each entry says what it actually is, so a deliberate exemption is distinguishable
 * from an accumulated one. Empty today; the mechanical vocabulary below covers every real name.
 */
const KNOWN_NON_SCRIPT = new Map();

/**
 * A positive wiring verb. "moved into", "belongs in" and "should run in" are deliberately absent: they
 * describe a proposal or an obligation, not a state of the repository, and only a state is checkable.
 */
const WIRING = "(?:runs?|run|running|is\\s+run|are\\s+run|wired|is\\s+wired|are\\s+wired)" +
  "\\s+(?:in|into|as\\s+part\\s+of|on\\s+every)";
/** The subject list: one or more backticked tokens joined by commas, slashes or "and". */
const SUBJECTS = "(?:`[A-Za-z0-9_@./-]+`(?:\\s*(?:,|and|/)\\s*)?)+";
/** Up to two adverbs between the list and the verb ("now runs in", "also runs on every"). */
const CLAIM = new RegExp(
  "(" + SUBJECTS + ")\\s*(?:[-,:]\\s*)?((?:\\w+\\s+){0,2}?)" + WIRING +
    "\\s+`npm\\s+(test|run\\s+[a-z][a-z0-9-]*)`",
  "gi",
);
/**
 * A negated wiring claim is skipped, not checked. The repair for a finding from this guard is written
 * in exactly this shape ("`check-release-counts` is not wired into `npm test`"), and a guard that reds
 * on the sentence fixing it is the failure mode this repository recorded once already.
 */
const NEGATION = /\b(?:not|never|n't|no\s+longer|rather\s+than|instead\s+of|cannot|neither|nor)\b/i;
const TOKEN = /`([A-Za-z0-9_@./-]+)`/g;

const read = (p) => fs.readFileSync(p, "utf8");

/**
 * Every wiring claim made on ONE line, as `{ name, npmScript }` pairs. Pure, and exported so the scoop
 * can be tested without a git tree - the same split check-doc-enumerations makes with `scanLine`.
 * `vocab` is the set of script basenames this repository ships; a backticked token outside it is some
 * other kind of name and is skipped rather than guessed at.
 */
export function claimsOnLine(line, vocab) {
  const out = [];
  for (const m of line.matchAll(CLAIM)) {
    if (NEGATION.test(m[0])) continue;
    const npmScript = m[3].replace(/\s+/g, " ").startsWith("run ")
      ? m[3].replace(/\s+/g, " ").slice(4).trim()
      : "test";
    for (const t of m[1].matchAll(TOKEN)) {
      const name = t[1].replace(/^scripts\//, "").replace(/\.mjs$/, "");
      if (!vocab.has(name)) continue;
      if (KNOWN_NON_SCRIPT.has(name)) continue;
      out.push({ name, npmScript });
    }
  }
  return out;
}

/** Every top-level runnable script this repository ships, derived from the tree. */
export function scriptVocabulary(root) {
  const dir = path.join(root, "scripts");
  const names = new Set();
  if (!fs.existsSync(dir)) return names;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isFile() && e.name.endsWith(".mjs")) names.add(e.name.slice(0, -4));
  }
  return names;
}

/**
 * The resolved command chain for an npm script: its own command plus everything it reaches through
 * `npm test`, `npm run X` and npm's pre/post hooks. Returns the set of `scripts/<name>.mjs` basenames
 * that actually execute. A script merely having a unit test does NOT put it in here - that is the
 * distinction the whole guard turns on, since check-release-counts has two test files and still does
 * not run against this repository in `npm test`.
 */
export function resolveNpmScript(pkg, name, seen = new Set()) {
  const out = new Set();
  if (seen.has(name)) return out;
  seen.add(name);
  const scripts = pkg.scripts ?? {};
  for (const hook of [`pre${name}`, name, `post${name}`]) {
    const cmd = scripts[hook];
    if (!cmd) continue;
    for (const m of cmd.matchAll(/scripts\/([A-Za-z0-9_-]+)\.mjs/g)) out.add(m[1]);
    for (const m of cmd.matchAll(/npm\s+(?:run\s+)?([a-z][a-z0-9-]*)/g)) {
      const target = m[1] === "run" ? null : m[1];
      if (target && target !== name) for (const s of resolveNpmScript(pkg, target, seen)) out.add(s);
    }
  }
  return out;
}

function governedDocs(root) {
  const out = execFileSync("git", ["ls-files", "*.md"], { cwd: root, encoding: "utf8", maxBuffer: 1 << 28 });
  return out
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((f) => !HISTORY_FILES.has(f) && !HISTORY_DIRS.some((d) => f.startsWith(d)));
}

export function findFalseWiringClaims(root = ".") {
  const pkgPath = path.join(root, "package.json");
  if (!fs.existsSync(pkgPath)) {
    return { error: `no package.json at ${pkgPath}; cannot check wiring claims`, findings: [], checked: 0, claims: 0 };
  }
  const pkg = JSON.parse(read(pkgPath));
  const vocab = scriptVocabulary(root);
  const resolved = new Map();
  const chainFor = (key) => {
    if (!resolved.has(key)) resolved.set(key, resolveNpmScript(pkg, key));
    return resolved.get(key);
  };

  const findings = [];
  const files = governedDocs(root);
  let claims = 0;
  for (const rel of files) {
    let text;
    try { text = read(path.join(root, rel)); } catch { continue; }
    const lines = text.replace(/\r\n/g, "\n").split("\n");
    let fenced = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^\s*```/.test(line)) { fenced = !fenced; continue; }
      if (fenced || isHistoryLine(line)) continue;
      for (const { name, npmScript } of claimsOnLine(line, vocab)) {
        claims += 1;
        if (chainFor(npmScript).has(name)) continue;
        findings.push({ file: rel, line: i + 1, name, npmScript });
      }
    }
  }
  return { error: null, findings, checked: files.length, claims };
}

function main() {
  const root = process.argv[2] ?? ".";
  const { error, findings, checked, claims } = findFalseWiringClaims(root);
  if (error) {
    console.error(`check-stale-state: ${error}`);
    process.exit(1);
  }
  if (findings.length === 0) {
    console.log(
      `OK check-stale-state: ${checked} governed file(s); all ${claims} wiring claim(s) name a script that ` +
        `package.json actually runs.`,
    );
    return;
  }
  console.error(`check-stale-state: ${findings.length} claim(s) say a script runs where package.json does not run it.\n`);
  for (const f of findings) {
    console.error(
      `  ${f.file}:${f.line}  claims \`${f.name}\` runs in \`npm ${f.npmScript === "test" ? "test" : `run ${f.npmScript}`}\`, ` +
        `but package.json's "${f.npmScript}" chain does not invoke scripts/${f.name}.mjs`,
    );
  }
  console.error(
    `\nEither the wiring was never done (repair the sentence and say where the script actually runs), or\n` +
      `the script belongs in that npm script, in which case wire it up in package.json.`,
  );
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("check-stale-state.mjs")) {
  main();
}
