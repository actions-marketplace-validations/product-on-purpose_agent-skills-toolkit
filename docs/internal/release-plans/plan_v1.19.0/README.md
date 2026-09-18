---
title: "v1.19.0 - current with the vendors: the record catches up with what the vendors actually do"
---

# v1.19.0 - the packet

**Written 2026-09-17 at `1d321c5`.** Forty-six commits since `v1.18.0`; **101 files changed, 3,087
insertions, 2,369 deletions**, with the release trail landing on top.

This is a **minor**. It adds one numbered check, tightens two, and ships one Standard revision.

## Numbers, measured at the release commit and not inherited

| | |
| --- | --- |
| Suite | **1575 tests, 1571 pass, 0 failures, 4 skipped** (1485 at `v1.18.0`) |
| Gate | Advanced, 0 errors, 0 warnings |
| `release-ready` | six gates green |
| Standard | **0.16**, from 0.15 |
| Spine | **35 checks**, from 34 |
| Skills | 26, unchanged |

## Why this release exists

Its name is **"current with the vendors"**, and every item shares one shape: **this repository was
asserting something about a vendor that the vendor had stopped doing.**

- The Codex source record was 20 days stale in three separate ways - the page had moved host, the hook
  event count had grown from eleven to twelve, and `STANDARD.md` still listed ten.
- The Claude Code record was 26 versions behind.
- Two pinned sentences on the Claude Code plugins reference had been reworded, and `STANDARD.md` was
  quoting one of them under the word *verbatim* while shipping to npm.
- Codex silently **drops** an oversized command rather than truncating it, which `U18` now catches.

## The eight bug fixes that nearly went in the bin

The session that finished this cut opened with an instruction to copy an audit folder and close its
branch. The branch carried **eight unmerged bug fixes with no pull request**, and closing it would have
destroyed them: two regexes that hung the gate forever, a symlink escape that made the gate walk the
host filesystem, a 64 KB truncation of every piped machine output, a silently dropped CLI flag, a
finding filed under the wrong requirement id, a missing `--help` entry, and a byte-order mark that
dropped a valid plugin to `Tier: None`. Seven of the eight original shas are preserved on `main`.

## What is deliberately NOT in this release

- **The four graduations.** `U18`, `G1`, `G2` and `G8` all carry `until: "0.17"`. Cut 6 closes those
  windows and is ruled **graduations only**.
- **The audit's five-item strengthening set**, which goes to Standard 0.18 under its own name.
- **D-01, the health score beside the tier**, deferred - a Bronze plugin can legitimately outscore a
  Gold one, and a badge that can do that is confusing rather than informative.
