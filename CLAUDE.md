# CLAUDE.md

Project-specific instructions for Claude Code when working in this repository.

## PR descriptions: "Test Plan" vs "Quality Checks"

These are two distinct sections. Do not conflate them, and do not label the
second one "Test Plan":

- **Test Plan** — a human-facing section describing how a person would
  manually exercise the new/changed behavior on a deployed instance of the
  app: what page/URL to go to, what to click, what input to enter, and what
  result to expect. Written for a human reviewer who wants to try the change
  themselves, with no knowledge of the implementation. Numbered steps or a
  checklist, not a description of automated tests.

- **Quality Checks** — the list of automated steps taken to ensure
  correctness: new/updated unit and integration tests, coverage percentages
  (Jacoco), mutation testing scores (Pitest/Stryker), lint/format checks,
  `mvn verify` results, etc. This is developer-facing QA record-keeping. Use
  this exact heading — not "Test Plan" — for this content.

Every PR description should include a **Test Plan** section with real manual
testing steps whenever the change has any user-visible or clickable surface.
The **Quality Checks** section is additive, not a substitute for it.

## Pull requests ALWAYS target `main`

Every PR in this repository must have `main` as its base branch. Never open a
PR against another feature branch ("stacked" PRs), no matter how much the new
work depends on a PR that has not merged yet.

Why: on 2026-10-28 a chain of stacked PRs (#17, #22, #28, #30, #31, #34, #35)
was merged, and GitHub merged each one into the previous feature branch instead
of `main`. All of them showed as merged, but none of that work reached `main`,
and it had to be recovered by hand.

The workflow here is: branch from `main`, open the PR against `main`, and merge
PRs in order from oldest to newest. If a PR depends on an earlier unmerged PR,
its diff will show the earlier commits too; say so in the description and let
the reviewer merge in order. Before `gh pr create`, confirm `--base main`.
