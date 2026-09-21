# 0061 - U18 is permanently warn, and the strengthening set is Standard 0.18

## TL;DR

- **Decision one: `U18` (`command-size-cap`) is PERMANENTLY `warn`. Its migration metadata is deleted, and no revision is scheduled to make it gate.** It shipped in v1.19.0 carrying `capAt: "warn", until: "0.17"` and a reason reading *"...and gates at 0.17"*. **That was false.**
- **Measured, with a positive control in the same run.** The check emits `SEVERITY.WARN` natively, so a `warn` cap over it is a no-op. Graded against a fixture with an oversized Codex-targeted command:

  | pin | `U18` | `G2` (control) |
  | --- | --- | --- |
  | 0.16 | `warn` | `warn` - held down by its own cap |
  | 0.17 | **`warn` - unchanged** | **`error` - graduated** |

  `G1`, `G2` and `G8` all emit `SEVERITY.ERROR` natively and are capped DOWN, so their caps do real work. `U18` was the odd one out. The control matters: without it, "`U18` did not move" is equally consistent with "caps do not work at all here".
- **The fix is to delete the cap, not to raise the severity, and [ADR 0058](0058-a-vendor-that-drops-a-component-is-a-finding-and-the-proxy-is-declared.md) is why.** That ADR made the check `warn` deliberately: it measures the SOURCE file while the vendor caps the RENDERED skill, so the measurement is a declared proxy. Its own words - *"a warn says 'at risk, go and check'; an error would assert a fact about rendered output the check never measured"*. **The migration metadata contradicted the ADR that created the check.**
- **Deleting an inert cap is safe, and that is NOT the general rule.** Expired caps elsewhere in this tree are deliberately left in place, because removing one red-lines every plugin still pinned below its version. That rule protects caps that DO something. This one changed no severity at any pin - measurable, and measured.
- **Decision two: the audit's five-item strengthening set is Standard 0.18.** Cut 6 is Standard 0.17 and is graduations only. The set needs a revision to hang on, and naming it is what makes the backlog entries executable instead of parked.
- **Cut 6 therefore closes THREE windows, not four.** `G1`, `G2` and `G8`. `U18` was never going to be the fourth.
- **Status:** **Accepted (2026-09-17).** Implemented in the same change.

- **Date:** 2026-09-17
- **Deciders:** maintainer (jprisant), with Claude (Opus 5)

## Builds on

- **[ADR 0058 (a vendor that silently drops a component is a finding, and the proxy is declared)](0058-a-vendor-that-drops-a-component-is-a-finding-and-the-proxy-is-declared.md)** - created `U18` and made it `warn` for the proxy reason this ADR restores. The defect corrected here is metadata that contradicted it.
- **[ADR 0044 (one post-resolution Standard ceiling and config provenance)](0044-one-post-resolution-standard-ceiling-and-config-provenance.md)** - supplies the `since` + finding-level `migration` pairing, and the distinction this ADR turns on: `since` and `until` do different jobs, and only one of them was ever needed here.
- **[ADR 0057 (unshipped work carries a name, never a version number)](0057-unshipped-work-carries-a-name-never-a-version-number.md)** - the reason naming Standard 0.18 is legitimate while naming a *plugin* version would not be. A Standard revision number is a place in a rulebook's sequence, not a position in a release queue.

## How a false claim shipped, and what actually failed

Two tests covered this metadata. They read:

```js
assert.equal(f.migration.until, "0.17");
assert.match(f.migration.reason, /introduced at Standard 0\.16 and gates at 0\.17/);
```

Both passed, on every run, through the whole of cut 4. **They proved the metadata SAID it. Neither proved the severity MOVED.** A test that reads a constant back out of the object that declares it cannot fail while the object is self-consistent, however wrong the object is about the world.

Those tests are **rewritten, not deleted** - they asserted the presence of the defect, and forcing them green would have kept the confusion. They now assert absence of the migration, and the replacement was proven able to fail by re-attaching a phantom cap.

**The general lesson, which is the reason this ADR exists rather than a one-line commit:** a check's declared migration and its emitted severity are two different facts, and only one of them was ever tested. Any future check carrying a cap should be tested by GRADING A FIXTURE AT BOTH PINS, not by reading its metadata back.

## Decision two: Standard 0.18

Cut 6 was ruled graduations only - Standard 0.17 closes windows and opens none. The audit's five-item strengthening set therefore has no revision to land on, and every backlog entry gated on it is parked on a number that does not exist.

**Standard 0.18 is that number.** The set, each with its handle:

- **B-13** - a subagent whose frontmatter does not parse produces no finding at all
- **B-17** - `S4` reads chain declarations but never file bodies, and an empty contract passes
- **B-19** - `G3` promises evals and verifies only that a file exists
- **B-20 / E64** - `G2` reads workflow text rather than parsing what runs
- **B-21** - the cross-agent drift checks compare only name and version

Each is a tightening, so each ships warn-first at 0.18 carrying `until: "0.19"`, per the rule that the revision introducing a requirement is never the one enforcing it.

**Naming it is not scheduling it.** No date is attached and no cut is promised. The number exists so the work can be written down against something real, which is precisely what was missing.

## What was considered and refused

**Raising `U18` to `error` so the cap would do something.** Refused: it inverts ADR 0058. The check would then assert a fact about rendered output it never measured, which is the thing the proxy declaration exists to prevent.

**Leaving the inert cap in place as a historical record.** Refused: it was never a record. A record states what was true; this stated a graduation that could not occur, and it is visible to any consumer reading `--json`.

**Folding the strengthening set into 0.17 after all.** Refused - that reverses a ruling made the same day, and on the same reasoning: a release whose identity is "the windows close" is legible in one sentence, and mixing nine items in two states is how a burndown stops being auditable.
