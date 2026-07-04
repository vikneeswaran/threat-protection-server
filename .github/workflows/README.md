# GitHub Actions Workflows

## Quality and Release Gate

Workflow file: `.github/workflows/quality-and-release-gate.yml`

### Trigger

- Runs on pull requests targeting `qa` and `main`
- Manual run supported via workflow dispatch

### What it does

1. Runs `lint`
2. Runs `type-check`
3. Runs `test`
4. Enforces `qa -> main` promotion rule for production PRs

## Benchmark Baseline

Workflow file: `.github/workflows/benchmark-baseline.yml`

### Trigger

- Manual dispatch (supports `base_url` and `runs` inputs)
- Weekly scheduled run (Monday 04:00 UTC)

### What it does

1. Runs API baseline script
2. Evaluates against threshold file in `ops/benchmark/api-baseline-thresholds.json`
3. Uploads benchmark artifacts from `ops/benchmark/reports/`

