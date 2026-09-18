# audit-corpus - evidence trees, not examples

These two plugin trees exist to make two backlog findings reproducible. They are graded by
`tests/unit/potemkin-gold.test.mjs` and `tests/unit/standard-pin-floor.test.mjs`, which pin the grade
each one earns **today**.

**Do not improve them.** Their defects are the evidence. A test that goes red here means either a
real behaviour change worth reading, or that someone tidied a fixture; check which before touching
anything.

## Inventory

- `potemkin-gold/` - the 2026-09-04 audit's `01-potemkin-gold`, copied byte-for-byte. Thirty-three
  placeholder files that satisfy every structural requirement of the Advanced tier and say nothing:
  every skill body reads `Do nothing.` It grades **Advanced, 0 errors, 0 warnings**. This is the
  evidence for E61 (the tier certifies file shape) in `docs/internal/backlog/enhancements.md`.
- `pin-abuse/` - the audit's `09-pin-abuse`, rebuilt here because the audit's generator resolves
  paths against a hard-coded directory and cannot be run from a clean clone. The same tree, renamed,
  declared Advanced, pinned to `"standard": "0.9"`, violating eight requirements introduced after
  0.9. It grades **Advanced, exit 0, 0 errors, 11 warnings**, every warning a downgrade bought by
  the pin. This is the evidence for E62 (the pin has no floor).

## One violation is deliberately absent from `pin-abuse/`

The audit's tree also carried a broken `docs/reference/diagram.md` that trips `U12` (mermaid-valid),
for nine waived requirements rather than eight. `U12` scans a repository repo-wide and `tests/` is
not in `SKIP_DIRS`, so a committed broken diagram fails **this** repository's own gate: adding it
moved `node scripts/check.mjs .` from Advanced / 0 errors to None / 2 errors. The ninth violation is
therefore written into a tmpdir copy inside `tests/unit/standard-pin-floor.test.mjs`, where the
fixture reproduces the audit's line exactly - nine requirements, 0 errors, 14 warnings. The repo's
own `U12` tests write their bad blocks the same way, for the same reason.
