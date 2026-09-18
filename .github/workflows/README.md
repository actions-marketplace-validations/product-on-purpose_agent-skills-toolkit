---
title: ".github/workflows - folder guide"
---

# .github/workflows

The CI and release automation: the conformance gate and a non-deploying site build on every PR, the GitHub Pages deploy, and the tag-driven release.

## Inventory

- `ci.yml` - the PR and push gate: the conformance run on a Node `[22.12.0, 24]` matrix, a Windows run, `npm audit`, a non-deploying site build, the gating validator-parity job, and the two consumer-position jobs that grade this repository THROUGH the Action it publishes rather than by calling its scripts (`gate-via-action` runs the working tree's own `action.yml`; `gate-via-published-action` runs the one published on `main`, which is the only one of the two that exercises remote `uses: owner/repo@ref` resolution and the runner's `_actions/` tree).
- `codeql.yml` - CodeQL static analysis (javascript-typescript suite, advanced setup); the committed file is the configuration source of truth, not the repository Settings toggle.
- `deploy-pages.yml` - builds the Astro site and deploys it to GitHub Pages.
- `publish-npm.yml` - the npm publish. A pushed `v*` tag reaches it, and so does an explicit `workflow_dispatch` (dry-run by default on that path). **A tag does not reach the registry on its own:** the `publish` job is bound to the `npm-publish` environment, whose required reviewer is the control that keeps publishing a deliberate act. Its last step asks the registry itself, rather than the local manifest, whether the version the tag names actually arrived (`scripts/verify-published-version.mjs`). *(This entry said "workflow_dispatch-only ... never fires on a tag push" from v1.17.0 until the release-identity pass; the tag trigger was added in v1.17.0 and this description was never updated.)*
- `release.yml` - the tag-driven release: re-runs the gate and `release-ready`, then publishes the GitHub release.
- `standards-watch.yml` - monthly re-verification of the pinned UPSTREAM standard (agentskills.io), on the 15th so it straddles the month with `vendor-watch`'s 1st. Opens a deduplicated issue on drift or refusal, exactly as `vendor-watch` does, and deliberately does NOT gate `release-ready` - see the closing note in the file, and E58.
- `vendor-watch.yml` - monthly re-verification of the pinned vendor claims; opens an issue rather than editing anything, because deciding what a vendor change MEANS is an ADR.
