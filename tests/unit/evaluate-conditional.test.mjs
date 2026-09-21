import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildConditional } from "../../scripts/evaluate.mjs";
import { evaluate } from "../../scripts/evaluate.mjs";
import { renderMarkdown } from "../../scripts/lib/report-render.mjs";
import { CHECKS } from "../../scripts/lib/registry.mjs";
import { gateExitFromFindings } from "../../scripts/check.mjs";
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../fixtures");
const MINIMAL = path.join(FIXTURES, "golden/minimal-skill");       // no diagrams, no enumerating manifest
const MERMAID_OK = path.join(FIXTURES, "golden/mermaid-ok");       // has valid mermaid diagrams
const SILVER = path.join(FIXTURES, "golden/silver-fixture");       // has enumerating manifest (components.skills)
const SPINE = CHECKS.map((m) => ({ reqId: m.meta.reqId, id: m.meta.id, tier: m.meta.tier }));

function optsFor(r, target, reportType = "conformance") {
  const lib = JSON.parse(readFileSync(path.join(target, "library.json"), "utf8"));
  const forGate = r.findings.filter((f) => !f.suppressed).map((f) => ({ ...f, severity: f.effectiveSeverity ?? f.severity }));
  const { exitCode } = gateExitFromFindings(forGate, lib.tier);
  return { library: lib, spine: SPINE, conditional: buildConditional(target), date: "2026-01-01", exitCode, reportType };
}

// --- RED: buildConditional includes U12 and U13 when artifacts are absent ---

test("buildConditional: includes U12 when target has no mermaid diagrams", () => {
  const cond = buildConditional(MINIMAL);
  assert.ok(cond.has("U12"), "U12 must be in conditional set when no mermaid diagrams exist");
});

test("buildConditional: includes U13 when target has no enumerating manifest", () => {
  const cond = buildConditional(MINIMAL);
  assert.ok(cond.has("U13"), "U13 must be in conditional set when no enumerating manifest exists");
});

// --- Guard: no false N/A when artifacts ARE present ---

test("buildConditional: does NOT include U12 when target has mermaid diagrams", () => {
  const cond = buildConditional(MERMAID_OK);
  assert.ok(!cond.has("U12"), "U12 must NOT be in conditional set when mermaid diagrams exist");
});

test("buildConditional: does NOT include U13 when target has an enumerating manifest", () => {
  const cond = buildConditional(SILVER);
  assert.ok(!cond.has("U13"), "U13 must NOT be in conditional set when enumerating manifest exists");
});

// --- End-to-end: U12 and U13 render N/A in report for minimal-skill ---

test("evaluate + render: U12 renders N/A for a plugin with no mermaid diagrams", () => {
  const r = evaluate(MINIMAL);
  const md = renderMarkdown(r, optsFor(r, MINIMAL));
  assert.match(md, /U12.*N\/A|N\/A.*U12/s, "U12 must appear as N/A in the report");
});

test("evaluate + render: U13 renders N/A for a plugin with no enumerating manifest", () => {
  const r = evaluate(MINIMAL);
  const md = renderMarkdown(r, optsFor(r, MINIMAL));
  assert.match(md, /U13.*N\/A|N\/A.*U13/s, "U13 must appear as N/A in the report");
});

// --- Guard: U12 renders PASS (not N/A) when diagrams exist and are valid ---

test("evaluate + render: U12 renders PASS (not N/A) for a plugin with valid mermaid diagrams", () => {
  const r = evaluate(MERMAID_OK);
  const md = renderMarkdown(r, optsFor(r, MERMAID_OK));
  // The U12 row must not show N/A
  const u12Line = md.split("\n").find((l) => l.includes("U12") && l.includes("|"));
  assert.ok(u12Line, "U12 row must appear in the report table");
  assert.ok(!u12Line.includes("N/A"), "U12 must not render N/A when valid diagrams exist");
});

// --- Guard: U13 renders PASS (not N/A) when enumerating manifest is clean ---

test("evaluate + render: U13 renders PASS (not N/A) for silver-fixture which has components.skills", () => {
  const r = evaluate(SILVER);
  const md = renderMarkdown(r, optsFor(r, SILVER));
  const u13Line = md.split("\n").find((l) => l.includes("U13") && l.includes("|"));
  assert.ok(u13Line, "U13 row must appear in the report table");
  assert.ok(!u13Line.includes("N/A"), "U13 must not render N/A when enumerating manifest exists");
});

// --- F-007: N/A must mean "the check's precondition was not met", never "the check ran and passed" ---
//
// The 2026-09-04 audit's F-007: buildConditional carried a FIXED base set of G1, G6 and U11, so this
// repository - which ships hooks/hooks.json and declares 35 components - rendered
// `G1 hook-documentation | N/A | Nothing to validate for this subject (vacuous pass).` for a hook that
// G1 had examined and passed. Each assertion below names the condition buildConditional tests. That
// condition APPROXIMATES the check module's not-applicable case and is not always the module's own
// early-return expression; U11 and G6 below say where the two diverge.

/** A throwaway plugin root; `files` maps a relative path to its contents. */
function tempPlugin(files) {
  const dir = mkdtempSync(path.join(tmpdir(), "askit-cond-"));
  for (const [rel, body] of Object.entries(files)) {
    const full = path.join(dir, rel);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, body);
  }
  return dir;
}

const LIB_NO_COMPONENTS = JSON.stringify({ name: "t", version: "1.0.0", description: "d", standard: "0.16", tier: "universal" });
const LIB_WITH_COMPONENTS = JSON.stringify({
  name: "t", version: "1.0.0", description: "d", standard: "0.16", tier: "universal",
  components: { skills: [{ name: "t-one", path: "skills/t-one/SKILL.md", version: "1.0.0", tier: "universal", status: "active" }] },
});
const HOOKS_JSON = JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: "command", command: "true" }] }] } });
const MCP_JSON = JSON.stringify({ mcpServers: { demo: { command: "node", args: ["server.mjs"] } } });

// G1 (hook-documentation): the precondition is `if (!isFile(hooksPath)) return []` - checks/hook-documentation.mjs.
test("buildConditional: includes G1 when the subject ships no hooks/hooks.json", () => {
  const dir = tempPlugin({ "library.json": LIB_NO_COMPONENTS });
  try {
    assert.ok(buildConditional(dir).has("G1"), "G1 is N/A only when there is no hooks.json");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("buildConditional: does NOT include G1 when the subject ships hooks/hooks.json", () => {
  const dir = tempPlugin({ "library.json": LIB_NO_COMPONENTS, "hooks/hooks.json": HOOKS_JSON });
  try {
    assert.ok(!buildConditional(dir).has("G1"), "a hook G1 examined and passed must not report as 'nothing to validate'");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// U11 (mcp-valid): the condition here is "no .mcp.json on disk", which the module's own docblock states as
// "Conditional: no .mcp.json => not applicable". mcp-valid.mjs itself returns early on `servers.length === 0`,
// so a PRESENT .mcp.json holding `{"mcpServers": {}}` renders PASS rather than N/A (measured 2026-09-18).
test("buildConditional: includes U11 when the subject ships no .mcp.json", () => {
  const dir = tempPlugin({ "library.json": LIB_NO_COMPONENTS });
  try {
    assert.ok(buildConditional(dir).has("U11"), "U11 is N/A only when there is no .mcp.json");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("buildConditional: does NOT include U11 when the subject ships .mcp.json", () => {
  const dir = tempPlugin({ "library.json": LIB_NO_COMPONENTS, ".mcp.json": MCP_JSON });
  try {
    assert.ok(!buildConditional(dir).has("U11"), "a .mcp.json U11 parsed and validated must not report as 'nothing to validate'");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// G6 (deprecation): the condition here is "no component entry in any list", which is STRICTER than
// deprecation.mjs:21's own guard (a missing or non-object `components`): `"components": {}` is N/A here
// while the check does NOT early-return (measured 2026-09-18). It is deliberately NOT "no deprecated
// entry": G6 validates the `status` of EVERY entry, so an all-active plugin has had its statuses
// examined; keying N/A on "no deprecated component" would reproduce F-007 one check over.
test("buildConditional: includes G6 when library.json declares no component entries", () => {
  const dir = tempPlugin({ "library.json": LIB_NO_COMPONENTS });
  try {
    assert.ok(buildConditional(dir).has("G6"), "G6 is N/A only when there are no component entries to read a status from");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("buildConditional: does NOT include G6 when every component entry is status active", () => {
  const dir = tempPlugin({ "library.json": LIB_WITH_COMPONENTS });
  try {
    assert.ok(!buildConditional(dir).has("G6"), "G6 examined an active entry's status; that is a pass, not a vacuous pass");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// End-to-end on the audit's own reproduction target: this repository ships hooks/hooks.json and 35
// declared components, so neither G1 nor G6 may render N/A in its own report.
test("evaluate + render: this repository renders G1 and G6 as examined, not N/A", () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const r = evaluate(root);
  const md = renderMarkdown(r, optsFor(r, root));
  for (const reqId of ["G1", "G6"]) {
    const row = md.split("\n").find((l) => l.startsWith(`| ${reqId} `));
    assert.ok(row, `${reqId} row must appear in the report table`);
    assert.ok(!row.includes("N/A"), `${reqId} must not render N/A on a subject that has the artifact it grades: ${row}`);
  }
});
