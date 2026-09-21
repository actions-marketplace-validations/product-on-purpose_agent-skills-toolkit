import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { buildRows, render, readCommitted, extractMusts, ADR_0059_CLAUSES, PAGE } from "../../scripts/gen-standard-coverage.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const norm = (s) => String(s).replace(/\r\n/g, "\n");

// A throwaway root carrying a (possibly mutated) STANDARD.md, so a RED case never touches the real one.
function tempRoot(mutate = (s) => s) {
  const dir = mkdtempSync(path.join(tmpdir(), "askit-cov-"));
  writeFileSync(path.join(dir, "STANDARD.md"), mutate(readFileSync(path.join(ROOT, "STANDARD.md"), "utf8")));
  mkdirSync(path.join(dir, "docs", "reference"), { recursive: true });
  return dir;
}

// --- the drift guard ----------------------------------------------------------------------------

test("the committed coverage page matches what the generator produces", () => {
  assert.equal(
    norm(readCommitted(ROOT)),
    norm(render(ROOT)),
    `${PAGE} is out of date; regenerate with: node scripts/gen-standard-coverage.mjs . --write`
  );
});

test("every MUST in STANDARD.md carries a disposition, and no mapping is stale", () => {
  const { problems } = buildRows(ROOT);
  assert.deepEqual(problems, [], problems.join("\n"));
});

test("the MUST tokens reconcile: claimed clauses plus stated exclusions equal the raw count", () => {
  const { clauses, excluded, rawTokens } = extractMusts(path.join(ROOT, "STANDARD.md"));
  const claimed = clauses.reduce((s, c) => s + c.tokens, 0);
  assert.equal(claimed + excluded.total, rawTokens, "a MUST the parser loses is one the table would silently declare covered");
  assert.ok(!Object.keys(excluded.byReason).some((r) => r.startsWith("SPLITTER BUG")), "the splitter dropped a MUST token");
});

test("all seven of ADR 0059's ruled clauses are carried by a row", () => {
  const { rows } = buildRows(ROOT);
  const carried = new Set(rows.map((r) => r.adr0059).filter(Boolean));
  for (const c of ADR_0059_CLAUSES) assert.ok(carried.has(c), `ADR 0059 ruled "${c}" and no row carries it`);
  assert.equal(carried.size, ADR_0059_CLAUSES.length);
});

// --- RED: the guard shown failing, three ways ---------------------------------------------------
// "A guard that cannot be shown failing is not a guard." Each case restores the defect the guard
// exists to catch and asserts the guard reports it.

test("RED: a new MUST written into STANDARD.md with no disposition is reported UNMAPPED", () => {
  const dir = tempRoot((s) => s + "\n### 99. A section added by a test\nA plugin MUST do a brand new thing nobody has dispositioned.\n");
  try {
    const { problems } = buildRows(dir);
    assert.ok(problems.some((p) => p.startsWith("UNMAPPED MUST")), `expected an UNMAPPED problem, got:\n${problems.join("\n")}`);
    assert.throws(() => render(dir), /UNMAPPED MUST/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("RED: a clause deleted from STANDARD.md makes its mapping STALE", () => {
  // sec 8.2's uniqueness clause is one of ADR 0059's seven, so deleting it must trip TWO guards.
  const dir = tempRoot((s) => s.replace("Names MUST be unique within the plugin. ", ""));
  try {
    const { problems } = buildRows(dir);
    assert.ok(problems.some((p) => p.startsWith("STALE mapping")), `expected a STALE problem, got:\n${problems.join("\n")}`);
    assert.ok(problems.some((p) => p.includes('ADR 0059 ruled "sec 8.2 name collisions"')), "the ADR 0059 agreement check must also fail");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("RED: a one-character edit to the committed page is caught by the drift guard", () => {
  const page = render(ROOT);
  const tampered = page.replace("| `checked` |", "| `checkedX` |");
  assert.notEqual(norm(tampered), norm(page));
  assert.notEqual(norm(tampered), norm(readCommitted(ROOT)), "the drift guard compares the committed bytes against the generated ones");
});
