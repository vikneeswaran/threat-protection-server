# QA Promotion Policy (P0 Environment Control)

This policy defines the required path for every production release.

## Branch Model

- `feature/*` → developer changes
- `qa` → integration and validation branch
- `main` → production branch only

## Required Promotion Path

1. Create PR from `feature/*` to `qa`.
2. Pass quality gate checks (`lint`, `type-check`, `test`).
3. Run benchmark workflow and attach report artifact.
4. Perform QA sign-off.
5. Create PR from `qa` to `main`.
6. `main` promotion is valid only when source branch is `qa`.

## Release Tagging

- QA tags: `vX.Y.Z-qa.N`
- Production tags: `vX.Y.Z`

## Release Readiness Checklist

- [ ] All quality checks passed on PR.
- [ ] Latest benchmark report is green against thresholds.
- [ ] Rollback pack prepared and attached.
- [ ] DB migration safety reviewed.
- [ ] QA approval recorded.

## Owner Roles

- Engineering: feature implementation + tests
- QA: test evidence + approval
- Release owner: benchmark report + rollback pack + promotion
