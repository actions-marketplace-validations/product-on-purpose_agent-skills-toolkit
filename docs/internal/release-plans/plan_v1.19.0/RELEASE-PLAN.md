---
title: "v1.19.0 release plan - current with the vendors"
---

# v1.19.0 - release plan

**Class: minor.** One new numbered check, two checks tightened, one Standard revision. No verdict moves
for any adopter who does not raise their own pin.

Cut 4 of the resolution plan, named **"current with the vendors"** and complete on `main` since
2026-09-05. Per [ADR 0057](../../decisions/0057-unshipped-work-carries-a-name-never-a-version-number.md)
the number `1.19.0` is assigned here, at cut time, and appears nowhere earlier.

## Scope

| Item | Handle | State |
| --- | --- | --- |
| `U18` | command-size-cap: a Codex-bound command that is silently dropped | shipped, `warn`, capped `until: "0.17"` |
| `G1` | a hook handler type Codex parses and skips | tightened, capped `until: "0.17"` |
| `G2` | CI that credits a gate it does not execute | tightened, capped `until: "0.17"` |
| Standard 0.16 | one check added, two tightened | shipped; spine 34 -> 35 |
| RS-C1 | the Codex vendor record was 20 days stale in three ways | shipped |
| RS-C4 | Claude Code re-surveyed 26 versions forward to `2.1.261` | shipped |
| E59 | the marketplace `relevance` block ruled a dated no | filed with instrument, watcher and reopening trigger |
| audit wave 0 | eight external-audit bug fixes | shipped |
| `U6` | a root-relative web path resolved against the containing file | fixed |
| vendor pin refresh | two pinned sentences moved on the Claude Code plugins reference | shipped |

## Gates, measured at the release commit

| Gate | Result |
| --- | --- |
| `npm test` | **1575 tests, 1571 pass, 0 failures, 4 skipped** |
| `node scripts/check.mjs` | **Advanced, 0 errors, 0 warnings** |
| `npm run release-ready` | **six gates green** |
| Standard | **0.16** (from 0.15) |
| Spine | **35 checks** (from 34) |
| Skills | 26, unchanged |

## What an adopter has to do

**Nothing.** All three Standard 0.16 spine changes are warn-first and carry `until: "0.17"`, never
`until: "0.16"` - a cap expiring at the revision that introduces it would give adopters no migration
window at all. A plugin that stays pinned at 0.15 or 0.16 sees no new gate failure. The graduations
land at Standard 0.17, which is cut 6.

## The one accepted loss, stated rather than buried

`U6` no longer reports a dangling **root-relative** repository path. That is the deliberate cost of
refusing to make the check guess which of two path vocabularies a repository speaks, and it is asserted
as a test so inverting it reverses a decision rather than editing a line.

## Blast radius

**Measured, not argued.** Every check change was graded against all six reference-family members at the
catalogue's pinned shas, before and after. No text verdict, error count or exit code moved anywhere.
