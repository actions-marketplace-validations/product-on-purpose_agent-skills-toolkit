// what-it-is:   the E61 evidence - a plugin of placeholder files, graded
// what-it-does: grades tests/fixtures/audit-corpus/potemkin-gold and pins the grade it earns today
//               (Advanced, 0 errors, 0 warnings), and pins the fixture's own emptiness so the evidence
//               cannot be quietly improved away
// why:          E61 (the tier certifies file shape) is the 2026-09-04 audit's headline finding. Until this
//               file it rested on a tree in a gitignored audit folder, which meant nobody here could
//               re-run it. A finding nobody can reproduce is a citation, not evidence
// used-by:      npm test; tests/fixtures/audit-corpus/potemkin-gold is the tree it grades
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runGate } from "../../scripts/check.mjs";
import { evaluate } from "../../scripts/evaluate.mjs";

const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../fixtures");
const POTEMKIN = path.join(FIXTURES, "audit-corpus/potemkin-gold");

/**
 * WHAT THIS FIXTURE IS, AND WHY IT IS PINNED RATHER THAN FIXED.
 *
 * `01-potemkin-gold` was built by the 2026-09-04 external audit as its `F-001`: thirty-three files that
 * satisfy every structural requirement the Advanced tier asks for and say nothing. Every skill body reads
 * `Do nothing.`; four of the nine docs pages read `Content for <its own title>.`. It is copied here
 * byte-for-byte from the audit's corpus.
 *
 * These are characterization tests. They assert what the gate DOES today, not what it should do. The
 * remedy - reporting something beside the tier that a placeholder plugin cannot score well on - is
 * D-01 (a health score beside the tier), which is deferred. When D-01 lands, REWRITE these assertions
 * to the new behaviour; do not "fix" the fixture, and do not force this file green. The fixture's value
 * is precisely that it is empty.
 */
test("E61 (the tier certifies file shape): a plugin of placeholder files grades Advanced, clean", () => {
  const g = runGate(POTEMKIN);
  const e = evaluate(POTEMKIN);

  assert.equal(e.tier, "advanced", "the placeholder plugin earns the top tier");
  assert.equal(g.errorCount, 0);
  assert.equal(g.exitCode, 0, "the gate passes it");
  // Zero warnings is the load-bearing half. The fixture pins `"standard": "0.15"`, one minor behind the
  // repository's own pin, so a reader could reasonably ask whether the pin is doing the work. It is not:
  // nothing at all was held back, at any severity.
  assert.equal(g.warnCount, 0, "nothing was held back by the fixture's pin either");
  assert.equal(g.findings.filter((f) => f.downgraded).length, 0);
});

test("E61 (the tier certifies file shape): every skill body in the fixture is still the placeholder", () => {
  const skillsDir = path.join(POTEMKIN, "skills");
  const names = readdirSync(skillsDir).sort();
  assert.deepEqual(names, ["pg-skill-one", "pg-skill-two", "pg-skill-three"].sort());

  for (const name of names) {
    // Line endings are normalized before comparing: the repository is CRLF and a checkout elsewhere
    // need not be, and the claim is about the WORDS, not the bytes.
    const text = readFileSync(path.join(skillsDir, name, "SKILL.md"), "utf8").replace(/\r\n/g, "\n");
    const body = text.split(/^---$/m).slice(2).join("---").trim();
    assert.equal(
      body,
      `# ${name}\n\nDo nothing.`,
      `${name}/SKILL.md must stay a placeholder - it is the evidence. If you improved it, revert and ` +
      `read E61 (the tier certifies file shape) in docs/internal/backlog/enhancements.md first.`
    );
  }
});

test("E61 (the tier certifies file shape): the docs pages are placeholders too", () => {
  // Four of the nine pages under docs/ carry the `Content for <its own title>.` placeholder, and the
  // docblock above says four for that reason. The other five are deliberately NOT pinned because they
  // are not that string: `architecture.md` is a one-line cross-reference, and the four folder READMEs
  // are inventories that echo their own filenames.
  const placeholders = {
    "docs/explanation/architecture-detailed.md": "Architecture in detail",
    "docs/how-to/do-a-thing.md": "Do a thing",
    "docs/reference/checks.md": "Checks",
    "docs/tutorials/first-steps.md": "First steps",
  };
  for (const [rel, title] of Object.entries(placeholders)) {
    const page = readFileSync(path.join(POTEMKIN, rel), "utf8");
    assert.match(
      page,
      new RegExp(`Content for ${title}\\.`),
      `${rel} must stay a placeholder - it is the evidence. If you filled it in, revert and read ` +
      `E61 (the tier certifies file shape) in docs/internal/backlog/enhancements.md first.`
    );
  }
  const agents = readFileSync(path.join(POTEMKIN, "AGENTS.md"), "utf8");
  assert.match(agents, /This plugin ships 3 skills\./);
});
