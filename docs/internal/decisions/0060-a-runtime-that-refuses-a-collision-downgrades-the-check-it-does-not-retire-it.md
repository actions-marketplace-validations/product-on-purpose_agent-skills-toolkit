# 0060 - A runtime that refuses a collision downgrades the check, it does not retire it

## TL;DR

- **Decision: `marketplace-skill-collision` and `marketplace-command-collision` drop from `error` to `warn`, and their message stops claiming that one member silently wins.** They are NOT retired, which is what [ADR 0051 (no cross-member finding graduates to the spine)](0051-no-cross-member-finding-graduates-to-the-spine.md) and the ledger's own `onChange` both instructed on the face of it.
- **The probe that grounded them CHANGED.** Re-run 2026-09-17 on Claude Code **2.1.275**, with the fixtures this repository ships at `docs/internal/vendor-watch/probes/components-share-one-namespace/`. On three prior runs the bare name resolved silently to one side. It now fails:

  ```
  <tool_use_error>Unknown skill: probe-duplicate. Several skills match that name:
  probe-collision-a:probe-duplicate, probe-collision-b:probe-duplicate - invoke one by its full name.</tool_use_error>
  ```

  That is the raw `tool_result` with `is_error=true`, captured headlessly with `--output-format stream-json` so the record is the session's actual tool call rather than a model's account of one. **Reproduced with the install order reversed**; only the order the candidates are LISTED in follows install order.
- **Retiring would have been reasoning past the measurement, twice over.**
  1. **The claim is conditional on the agent.** Its own wording is *"on any agent that does not namespace components by plugin"*. This run measured **Claude Code only**. Codex is the other target this project emits for and was not tested. Retiring a marketplace check that may still protect Codex adopters, on evidence gathered entirely from Claude Code, is exactly the generalisation this repository has been burned by before.
  2. **A refusal is not the absence of harm, it is a different harm.** The failure the checks were written for - the wrong component silently winning - does appear to be gone on Claude Code. What replaced it is that the bare name becomes **unusable for every consumer who installs both plugins**. That is smaller, louder and recoverable, which is precisely the difference between an `error` and a `warn`.
- **The message was the false part, not the check.** It read *"which one wins is undefined"*. Nothing wins. A finding that describes a mechanism the runtime no longer has is a false claim shipped inside a true detection, and this repository grades other tools on exactly that.
- **The probe claim is re-worded and re-dated, and the date is honest.** `verifiedOn` advances to 2026-09-17 because the reproduction was actually run that day, not to clear the 2026-09-24 staleness wall. The wall is what forced this ADR rather than a silent renewal, which is the mechanism working.
- **Status:** **Accepted (2026-09-17).** Implemented in the same change.

- **Date:** 2026-09-17
- **Deciders:** maintainer (jprisant), with Claude (Opus 5)

## Builds on

- **[ADR 0051 (no cross-member finding graduates to the spine)](0051-no-cross-member-finding-graduates-to-the-spine.md)** - names this probe as the stated reopening condition for both checks, and supplies the UNILATERAL-REMEDY TEST that keeps them off the spine whatever their severity.
- **[ADR 0053 (a pin label is a claim, and behind is not a defect)](0053-a-pin-label-is-a-claim-and-behind-is-not-a-defect.md)** - the general shape applied here: a record that no longer describes what it points at is a defect in this repository even when nothing breaks.
- **[ADR 0058 (a vendor that silently drops a component is a finding, and the proxy is declared)](0058-a-vendor-that-drops-a-component-is-a-finding-and-the-proxy-is-declared.md)** - the severity argument reused in the opposite direction: there, `warn` because the measurement is a proxy; here, `warn` because the harm is recoverable and the second target is unmeasured.

## Context and problem statement

Two marketplace checks report when two members of a catalogue ship a component with the same name. Both were grounded in one probe claim, `components-share-one-namespace`, which said:

> Component names from different plugins enter a SHARED POOL on any agent that does not namespace components by plugin, so two members shipping the same skill directory name collide and which one wins is undefined.

A `probe` claim has no page to re-read, so **its age IS the verification**: past 30 days it blocks every release until a human re-runs the experiment. This one was verified 2026-08-24 and due to block 2026-09-24. It was re-run on 2026-09-17, early and deliberately, at the maintainer's instruction.

**It did not come back the same.** The full run record, including the prior three observations it contradicts, is in that probe's [`EXPECTED.md`](../vendor-watch/probes/components-share-one-namespace/EXPECTED.md).

### The decision table nearly answered this wrong, and had already been corrected for it

That probe's own table maps "two entries exist, distinguished by plugin" to **"the claim has CHANGED. Stop and read `onChange`"**, and `onChange` says retire. A note added 2026-08-20 - a month before the case it was written for arrived - warns that this row is misleading:

> Row 2 tests the **listing**; the claim is about **resolution**. Read it as applying only where the bare name fails to resolve or forces a disambiguation.

Today's run is the genuine row-2 case: the bare name was tried and it failed. The 2026-08-20 fourth outcome - prefixed entries listed while the bare name still resolved silently - is not what happened. **The correction is what makes the observation actionable rather than either dismissed or over-applied**, and it is the reason this ADR downgrades rather than retires.

## Decision

1. **Severity `error` -> `warn`** on both `marketplace-skill-collision` and `marketplace-command-collision`.
2. **The message stops asserting a silent winner.** It now states what a collision actually costs today: the bare name is refused on Claude Code and every consumer of both plugins must disambiguate by full name, and the resolution behaviour on Codex is unmeasured.
3. **Both checks keep `reqId: null` and stay off the spine.** ADR 0051's UNILATERAL-REMEDY TEST is untouched by this change: a collision is still a property of a PAIR of members where neither is wrong and the Standard names no yielder.
4. **The probe claim is re-worded** to state the measured 2026-09-17 behaviour and to carry, explicitly, that only Claude Code was measured.

## Consequences

**A catalogue with a colliding component name stops failing the gate and starts warning.** That is a relaxation, so per `STANDARD.md` sec 7.7 it can never make a passing catalogue fail and needs no migration window.

**The Codex gap is now recorded rather than assumed.** Nobody has measured whether Codex namespaces plugin-shipped skills. Until somebody does, the warn carries that ignorance in its own text instead of a confident sentence about a shared pool.

**What would reopen this.** If Codex is measured and DOES share a namespace, the silent-winner harm is real there and the severity question returns for Codex-targeting catalogues. If Claude Code reverts to silent resolution, both checks go back to `error`. Either way the instrument is the fixture pair this repository already ships, which is the point of shipping them.

## What was considered and refused

**Retiring both checks, as `onChange` says.** Refused on the two grounds in the TL;DR: one runtime measured out of two, and a real remaining cost. The instruction was written when the only imaginable change was a runtime that namespaces cleanly and invisibly. What actually arrived namespaces *loudly*, and a loud failure that every consumer hits is still worth one line of warning.

**Leaving the severity alone and only fixing the message.** Refused because the error severity encoded the silent-winner harm. Keeping a gate-failing error for a condition the runtime now announces to the user itself would make this project's own gate stricter than the runtime it grades for, on a point the runtime has taken responsibility for.

**Bumping `verifiedOn` without an ADR.** This is the move the probe mechanism exists to prevent, and the folder's README says so: refresh a date *as a record of a reading, never to make a run green*. The claim did not survive the reading.
