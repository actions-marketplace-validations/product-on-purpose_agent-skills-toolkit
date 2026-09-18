import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  findFalseWiringClaims,
  claimsOnLine,
  negationWindow,
  resolveNpmScript,
  scriptVocabulary,
} from "../../scripts/check-stale-state.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../..");
const PRE_FIX = path.join(REPO, "tests/fixtures/stale-state/pre-fix");

/** The scripts named in the captured sentence, as a scoop vocabulary for the pure-matcher tests. */
const VOCAB = new Set([
  "check-doc-enumerations",
  "check-readme-version",
  "check-claim-citations",
  "check-release-counts",
  "action-pin-watch",
]);

test("stale state: the guard names the real false wiring claim it was built for", () => {
  // tests/fixtures/stale-state/pre-fix/ carries docs/internal/backlog/enhancements.md line 716 captured
  // VERBATIM at fabb38a, beside the package.json whose `test` chain makes it false. The sentence argued
  // that `action-pin-watch` is uniquely exposed because it is a release-time gate, and listed
  // `check-release-counts` among the guards that run on every pull request - but check-release-counts is
  // itself a release-ready gate, so the entry understated its own hole by half.
  const { error, findings } = findFalseWiringClaims(PRE_FIX);
  assert.equal(error, null);
  assert.equal(findings.length, 1, `expected the one false wiring claim, got ${JSON.stringify(findings, null, 2)}`);
  assert.equal(findings[0].name, "check-release-counts");
  assert.equal(findings[0].npmScript, "test");
  assert.match(findings[0].file, /enhancements\.md$/);
  assert.ok(findings[0].line > 0, "every finding carries a line number a reader can open");
});

test("stale state: the three TRUE names in that same sentence are checked and pass", () => {
  // The finding above must come from grading four names and rejecting one, not from scooping a single
  // token. A guard that reached only the last name in the list would produce the identical finding here
  // while missing every defect written earlier in a list - which is exactly the adjacency mistake
  // check-claim-citations recorded, where scooping by the adjacent word caught one defect in four.
  const claims = claimsOnLine(
    "Every other claim guard in this repository - `check-doc-enumerations`, `check-readme-version`, " +
      "`check-claim-citations`, `check-release-counts` - runs in `npm test` and therefore on every pull request.",
    VOCAB,
  );
  assert.deepEqual(
    claims.map((c) => c.name),
    ["check-doc-enumerations", "check-readme-version", "check-claim-citations", "check-release-counts"],
    "all four subjects of the claim must be scooped, including the three that are true",
  );
});

test("stale state: the prose REPAIRING that claim does not red the guard", () => {
  // The other direction, and the one this repository has got wrong before: a guard that fires on the
  // text explaining its own finding. tests/fixtures/stale-state/pre-fix/docs/internal/backlog/repaired.md
  // is the corrected sentence captured verbatim from the live tree, and it contains both the script name
  // and `npm test` in the same breath ("`check-release-counts` does not run in `npm test`"). The fixture
  // run above reports ONE finding, not two, so the repaired file contributed none.
  const { findings } = findFalseWiringClaims(PRE_FIX);
  assert.equal(
    findings.filter((f) => /repaired\.md$/.test(f.file)).length,
    0,
    "the sentence that repairs the defect must not itself be reported",
  );
});

test("stale state: the negation exclusion is load-bearing, not accidentally inert", () => {
  // "A guard that cannot be shown failing is not a guard" applied to the EXCLUSION. Strip the negation
  // from the repaired sentence and the identical shape must be reported, which proves the previous test
  // passes because the negation was recognised rather than because the claim shape was never matched.
  const negated = "`check-release-counts` does not run in `npm test`.";
  const asserted = "`check-release-counts` does run in `npm test`.";
  assert.deepEqual(claimsOnLine(negated, VOCAB), [], "a negated wiring claim is skipped, not checked");
  assert.deepEqual(
    claimsOnLine(asserted, VOCAB).map((c) => c.name),
    ["check-release-counts"],
    "the same sentence without the negation IS a claim",
  );
});

test("stale state: a script merely HAVING a unit test is not wired into npm test", () => {
  // The distinction the whole guard turns on. check-release-counts has two test files under tests/unit/,
  // both of which run inside `npm test` - against temp fixture directories. That is why "it is covered by
  // the suite" and "it grades this repository on every pull request" are different statements, and why
  // the truth half reads package.json's command chain rather than the tests directory.
  const pkg = { scripts: { test: "node scripts/check-readme-version.mjs . && node --test" } };
  const chain = resolveNpmScript(pkg, "test");
  assert.ok(chain.has("check-readme-version"));
  assert.equal(chain.has("check-release-counts"), false);
});

test("stale state: the resolved chain follows npm pre-hooks and `npm run` indirection", () => {
  // A claim can be true through one hop. `prepublishOnly: "npm test && node scripts/check.mjs"` is the
  // real shape in this repository, so the resolver must not report a script absent merely because the
  // invocation sits one script away.
  const pkg = {
    scripts: {
      pretest: "node scripts/gen-index.mjs",
      test: "npm run lint && node --test",
      lint: "node scripts/check-style.mjs .",
      prepublishOnly: "npm test && node scripts/check.mjs",
    },
  };
  const chain = resolveNpmScript(pkg, "test");
  assert.ok(chain.has("gen-index"), "a pretest hook runs as part of `npm test`");
  assert.ok(chain.has("check-style"), "`npm run lint` from inside test pulls lint's own scripts in");
  const publish = resolveNpmScript(pkg, "prepublishOnly");
  assert.ok(publish.has("check"), "prepublishOnly's own command");
  assert.ok(publish.has("check-style"), "and everything `npm test` reaches from there");
});

test("stale state: the live tree is clean, and that is the acceptance gate", () => {
  // If this reds, a governed document asserts wiring package.json does not do. The fix is to repair the
  // sentence (or wire the script up) - not to widen the scoop.
  const { error, findings, checked, claims } = findFalseWiringClaims(REPO);
  assert.equal(error, null);
  assert.ok(checked > 0, "the guard must actually read files; zero governed files is a silent pass");
  assert.ok(claims > 0, "the guard must actually scoop claims; zero claims checked is a silent pass");
  assert.deepEqual(findings, [], `false wiring claims on the live tree: ${JSON.stringify(findings, null, 2)}`);
});

test("stale state: the vocabulary is derived from the tree, not a literal", () => {
  const vocab = scriptVocabulary(REPO);
  assert.ok(vocab.has("check-stale-state"), "this guard is itself a script and must be in its own vocabulary");
  assert.ok(vocab.has("check-release-counts"));
  assert.equal(vocab.has("registry"), false, "scripts/lib/ is not a runnable-script root");
});

test("stale state: a claim about `npm run <name>` is resolved against THAT script", () => {
  const claims = claimsOnLine("`check-release-counts` runs in `npm run release-counts`.", VOCAB);
  assert.deepEqual(claims, [{ name: "check-release-counts", npmScript: "release-counts" }]);
});

test("stale state: a backticked token that is not one of this repo's scripts is not guessed at", () => {
  // The refusal-to-guess boundary. `tests/fixtures/u5-calibration/` appears in a real governed line that
  // ends "and run on every `npm test`" (docs/internal/audit-intake.md), and it is a fixture directory,
  // not a script. Scooping it would produce a finding no edit could satisfy.
  assert.deepEqual(claimsOnLine("the descriptions were extracted to `tests/fixtures/u5-calibration/` and run on every `npm test`", VOCAB), []);
});

test("stale state: a negation placed BEFORE the subject list is seen, and only within its own sentence", () => {
  // A reported false positive, fixed here. NEGATION used to be tested against the match alone, and a match
  // begins at the claim's first backtick - so "It is not true that `X` runs in `npm test`" carried its
  // denial outside the window and the guard fired on a sentence denying the claim. Both directions, because
  // an exclusion that swallows the positive case would pass the first assertion for the wrong reason.
  const denied = "It is not true that `check-release-counts` runs in `npm test`.";
  const asserted = "It is true that `check-release-counts` runs in `npm test`.";
  assert.deepEqual(claimsOnLine(denied, VOCAB), [], "a denial ahead of the subject list is a negation");
  assert.deepEqual(
    claimsOnLine(asserted, VOCAB).map((c) => c.name),
    ["check-release-counts"],
    "the same lead-in without the denial IS a claim - the window must not swallow the positive case",
  );
});

test("stale state: the negation lead-in stops at the sentence before, so it cannot mute a real claim", () => {
  // The cost of the fix above, bounded and proved. Widening the negation window makes the guard skip more,
  // and a window that ran to the start of the line would let any earlier "not" hide a false claim written
  // later in the same paragraph. The lead-in stops at the nearest `.` or `;`.
  const line = "That is not the wiring. `check-release-counts` runs in `npm test`.";
  assert.deepEqual(
    claimsOnLine(line, VOCAB).map((c) => c.name),
    ["check-release-counts"],
    "a negation in the previous sentence must not suppress the claim in this one",
  );
  assert.equal(negationWindow(line, 24, "TAIL"), " TAIL", "the window starts after the full stop, carrying nothing from the sentence before");
});
