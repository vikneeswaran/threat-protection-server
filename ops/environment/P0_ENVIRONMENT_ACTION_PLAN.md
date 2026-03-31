# P0 Environment Action Plan (Implemented)

This document tracks the implemented environment-first controls.

## Implemented Controls

### 1) Benchmark + Baseline

- Script: `scripts/benchmark/collect-api-baseline.mjs`
- Threshold file: `ops/benchmark/api-baseline-thresholds.json`
- Workflow: `.github/workflows/benchmark-baseline.yml`
- Output: `ops/benchmark/reports/latest-api-baseline.md` and JSON

### 2) QA Branch + Promotion Gate

- Workflow: `.github/workflows/quality-and-release-gate.yml`
- Policy: `ops/release/QA_PROMOTION_POLICY.md`
- Enforced rule: PRs into `main` must originate from `qa`

### 3) Rollback Model

- Runbook: `ops/rollback/ROLLBACK_RUNBOOK.md`
- Pack template: `ops/rollback/ROLLBACK_PACK_TEMPLATE.md`

### 4) DB Communication Mapping

- Matrix: `ops/db/DB_COMMUNICATION_MATRIX.md`

## How to Execute P0 Gate Before Production

1. Run benchmark workflow and validate threshold status is PASS.
2. Confirm QA PR checks pass (`lint`, `type-check`, `test`).
3. Prepare rollback pack for release.
4. Verify DB communication matrix for impacted routes.
5. Promote `qa` → `main` only.

## Local Command Reference

```bash
npm run benchmark:baseline
```

Optional env vars:

- `BENCHMARK_BASE_URL`
- `BENCHMARK_RUNS`
- `BENCHMARK_THRESHOLD_FILE`
- `BENCHMARK_REPORT_DIR`
