# Jev PR gate

GitHub Actions Dependabot PRs must pass the normal `Test` workflow first. The privileged `workflow_run` job then evaluates the exact successful head SHA with Jev before any automatic merge.

Routing:

- `AUTO_MERGE`: continue to the SHA-pinned squash merge path.
- `CODEX_REVIEW`: leave the PR open for deeper automated review.
- `HUMAN_REVIEW`: leave the PR open for manual review.

The gate is fail-closed. Missing credentials, AI Gateway failures, invalid Jev responses, stale PR SHAs, major updates, changes to the gate itself, changes to the Test workflow, or unexpected non-workflow files never auto-merge.

The Jev request treats the PR title/body/diff as untrusted data. Only the trusted `master` copy of the gate script is executed in the privileged workflow.

## Required secret

Add an Actions repository secret named `AI_GATEWAY_API_KEY` containing the Vercel AI Gateway key.

## Optional repository variables

- `JEV_MODEL` (default: `typesafe-ai/jev`)
- `JEV_MIN_CONFIDENCE` (default: `0.40`)
- `JEV_MIN_AUTO_PROBABILITY` (default: `0.60`)
- `JEV_MIN_AUTO_MARGIN` (default: `0.20`)
