import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  findSelfInconsistency,
  firstDivergence,
  normalizeEol,
  spineDisagreements,
  SPINE_FIELDS,
  RESOLVED_MANIFEST,
} from "../../scripts/check-self-consistency.mjs";
import { renderManifest } from "../../scripts/generators/gen-manifest.mjs";
import { loadPlugin } from "../../scripts/lib/load-plugin.mjs";
import { CHECKS } from "../../scripts/lib/registry.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../..");
const FIX = path.join(REPO, "tests/fixtures/self-consistency");

test("self consistency: the guard reds on the drift measured on main, naming both spine fields", () => {
  // tests/fixtures/self-consistency/pre-fix/ reproduces the defect measured at 3ee7170 on 2026-09-19:
  // manifest.generated.json carrying version 9.9.9 and standard 0.01 against a library.json reading
  // 1.19.0 and 0.16. On the real tree that state left `node scripts/check.mjs .` at 0 errors 0 warnings
  // and the whole suite at 1659 tests / 0 failures.
  const { error, spine, divergence } = findSelfInconsistency(path.join(FIX, "pre-fix"));
  assert.equal(error, null);
  assert.deepEqual(
    spine.map((d) => [d.field, d.manifest, d.library]),
    [
      ["version", "9.9.9", "1.19.0"],
      ["standard", "0.01", "0.16"],
    ],
    "both drifted fields must be named against library.json directly, not just as a line diff",
  );
  assert.ok(divergence, "the whole-document comparison must diverge too");
  assert.equal(divergence.line, 3);
});

test("self consistency: the repaired tree is green, so the guard is not firing on everything", () => {
  // The other direction. A guard shown only failing has not been shown to discriminate; tests/fixtures/
  // self-consistency/repaired/ is the identical tree with the manifest the generator actually produces.
  const { error, spine, divergence } = findSelfInconsistency(path.join(FIX, "repaired"));
  assert.equal(error, null);
  assert.deepEqual(spine, []);
  assert.equal(divergence, null);
});

test("self consistency: a body-only drift reds with ZERO spine disagreements", () => {
  // This is what proves the whole-document comparison is load-bearing rather than riding on the spine
  // comparison. tests/fixtures/self-consistency/body-drift/ has all four spine fields correct and one
  // stale skill description - the shape produced by editing a SKILL.md and forgetting the generator.
  // If the guard were only the four-field comparison, this tree would pass.
  const { error, spine, divergence } = findSelfInconsistency(path.join(FIX, "body-drift"));
  assert.equal(error, null);
  assert.deepEqual(spine, [], "the spine layer must find nothing here, or this proves nothing");
  assert.ok(divergence, "the generated-document layer must still red");
  assert.match(divergence.committed, /A stale description/);
  assert.match(divergence.generated, /re-derived manifest has a component list/);
});

test("self consistency: this repository's own committed manifest passes", () => {
  // The guard runs at the repository root in `npm test`, so the green case is asserted rather than
  // assumed. A guard that only ever runs against fixtures is not wired to anything.
  const { error, spine, divergence } = findSelfInconsistency(REPO);
  assert.equal(error, null);
  assert.deepEqual(spine, []);
  assert.equal(divergence, null, divergence ? JSON.stringify(divergence, null, 2) : "");
});

test("self consistency: CRLF on disk against LF from the generator is NOT a divergence", () => {
  // Measured at 3ee7170: the committed manifest is 11799 bytes CRLF and the generator emits 11647
  // characters LF, identical once normalized. A byte comparison would therefore red on every Windows
  // checkout, which is a guard that fails when nothing is wrong. Proved on strings so the assertion
  // survives whatever the checkout's core.autocrlf happens to be.
  const lf = '{\n  "name": "x",\n  "version": "1.0.0"\n}\n';
  const crlf = lf.replace(/\n/g, "\r\n");
  assert.notEqual(crlf, lf, "the two strings must genuinely differ, or this test asserts nothing");
  assert.equal(firstDivergence(crlf, lf), null);
  assert.equal(normalizeEol(crlf), lf);
});

test("self consistency: the divergence reported is the FIRST one, not a later one", () => {
  const a = "one\ntwo\nthree\nfour\n";
  const b = "one\nTWO\nthree\nFOUR\n";
  assert.deepEqual(firstDivergence(a, b), { line: 2, committed: "two", generated: "TWO" });
});

test("self consistency: a truncated manifest diverges at the missing line rather than passing", () => {
  // A prefix of the correct document must not read as agreement. The loop runs to the longer of the two
  // line counts for exactly this case. The label is asserted too, because an earlier draft printed an
  // empty string here and a reader could not tell a blank line from the end of the file.
  const full = "one\ntwo\nthree\n";
  const short = "one\ntwo\n";
  const d = firstDivergence(short, full);
  assert.ok(d, "a truncated file must be a divergence");
  assert.equal(d.line, 3);
  assert.equal(d.committed, "(the file ends here, after a final newline)");
  assert.equal(d.generated, "three");
});

test("self consistency: a lost final newline is a divergence, not a silent pass", () => {
  // Neither side is trimmed before comparing, deliberately. manifest.generated.json is written by the
  // generator with a trailing newline, so a committed copy that lost it has drifted - and `git diff`
  // would show it. A comparison that stripped the trailing blank to tidy up the line labels would let
  // this through.
  const d = firstDivergence("one\ntwo", "one\ntwo\n");
  assert.ok(d, "a missing final newline must be a divergence");
  assert.equal(d.line, 3);
  assert.equal(d.committed, "(the file ends before this line)");
  assert.equal(d.generated, "(the file ends here, after a final newline)");
});

test("self consistency: a spine field MISSING from the manifest is a disagreement, not a skip", () => {
  // Silence is what let the measured hole stand. A hand-edited manifest that simply dropped `standard`
  // must be as loud as one that carries the wrong value.
  const drift = spineDisagreements({ name: "x", version: "1.0.0", tier: "advanced" }, {
    name: "x",
    version: "1.0.0",
    tier: "advanced",
    standard: "0.16",
  });
  assert.deepEqual(drift, [{ field: "standard", manifest: null, library: "0.16" }]);
});

test("self consistency: SPINE_FIELDS is exactly what the generator copies out of library.json", () => {
  // Non-vacuity in the direction that matters: a later edit that shortened SPINE_FIELDS would quietly
  // stop policing a field while every test above still passed. This derives the expected set from the
  // generator's own output - the scalar top-level keys it emits - rather than restating a literal.
  const generated = JSON.parse(renderManifest(loadPlugin(REPO)));
  const scalarKeys = Object.entries(generated)
    .filter(([, v]) => v === null || typeof v !== "object")
    .map(([k]) => k);
  assert.deepEqual(scalarKeys, SPINE_FIELDS);
});

test("self consistency: an absent manifest is an error, not a pass", () => {
  // The file is tracked and generated, so its absence is a defect. A guard that treats a missing
  // artifact as "nothing to compare" is one `rm` away from being green forever.
  const empty = fs.mkdtempSync(path.join(REPO, "tests", "tmp-self-consistency-"));
  try {
    fs.writeFileSync(path.join(empty, "library.json"), JSON.stringify({ name: "x", version: "1.0.0" }));
    const { error } = findSelfInconsistency(empty);
    assert.match(String(error), new RegExp(`${RESOLVED_MANIFEST.replace(".", "\\.")} is missing`));
  } finally {
    fs.rmSync(empty, { recursive: true, force: true });
  }
});

test("self consistency: this is a HOUSE guard - it is in no spine check and carries no reqId", () => {
  // The scope constraint, asserted rather than promised. No plugin's grade may move because of this
  // file, so it must not appear in the registry the gate runs, and nothing in it may claim a reqId.
  const ids = CHECKS.map((c) => c.meta?.id);
  assert.ok(!ids.includes("self-consistency"), "the house guard must not be registered as a spine check");
  const source = fs.readFileSync(path.join(REPO, "scripts", "check-self-consistency.mjs"), "utf8");
  assert.ok(!/\breqId\s*:/.test(source), "a house guard carries no reqId");
  assert.ok(!/from\s+"\.\/checks\//.test(source), "a house guard must not import a spine check module");
});
