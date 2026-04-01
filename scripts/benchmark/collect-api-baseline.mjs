/* eslint-env node */

import fs from "node:fs/promises"
import path from "node:path"

const DEFAULT_ENDPOINTS = ["/api/health", "/"]
const DEFAULT_RUNS = 7
const baseUrl = (process.env.BENCHMARK_BASE_URL ?? "https://kuaminisystems.com").replace(/\/$/, "")
const runs = Number.parseInt(process.env.BENCHMARK_RUNS ?? String(DEFAULT_RUNS), 10)
const thresholdFile = process.env.BENCHMARK_THRESHOLD_FILE ?? "ops/benchmark/api-baseline-thresholds.json"
const reportDir = process.env.BENCHMARK_REPORT_DIR ?? "ops/benchmark/reports"

function percentile(sortedValues, pct) {
  if (sortedValues.length === 0) {
    return 0
  }

  const index = Math.min(sortedValues.length - 1, Math.ceil((pct / 100) * sortedValues.length) - 1)
  return sortedValues[index]
}

function round(value) {
  return Number(value.toFixed(2))
}

async function runProbe(endpoint) {
  const startedAt = Date.now()

  try {
    const response = await globalThis.fetch(`${baseUrl}${endpoint}`, {
      method: "GET",
      headers: {
        "x-kuamini-benchmark": "baseline",
      },
    })

    return {
      endpoint,
      status: response.status,
      ok: response.ok,
      durationMs: Date.now() - startedAt,
    }
  } catch (error) {
    console.warn(`Probe failed for ${endpoint}:`, error)
    return {
      endpoint,
      status: 0,
      ok: false,
      durationMs: Date.now() - startedAt,
    }
  }
}

function summarize(endpoint, samples) {
  const durations = samples.map((sample) => sample.durationMs).sort((a, b) => a - b)
  const failures = samples.filter((sample) => !sample.ok).length
  const failureStatuses = samples.filter((sample) => !sample.ok).map((sample) => sample.status)

  const avgMs = durations.length > 0 ? durations.reduce((sum, value) => sum + value, 0) / durations.length : 0

  return {
    endpoint,
    samples: samples.length,
    p50Ms: round(percentile(durations, 50)),
    p95Ms: round(percentile(durations, 95)),
    avgMs: round(avgMs),
    errorRatePct: round((failures / Math.max(samples.length, 1)) * 100),
    failureStatuses,
  }
}

function toMarkdown(report) {
  const lines = []
  lines.push("# API Baseline Report")
  lines.push("")
  lines.push(`- Base URL: ${report.baseUrl}`)
  lines.push(`- Created At (UTC): ${report.createdAt}`)
  lines.push(`- Runs Per Endpoint: ${report.runsPerEndpoint}`)
  lines.push("")
  lines.push("| Endpoint | Samples | p50 (ms) | p95 (ms) | Avg (ms) | Error Rate (%) |")
  lines.push("|---|---:|---:|---:|---:|---:|")

  for (const metric of report.metrics) {
    lines.push(
      `| ${metric.endpoint} | ${metric.samples} | ${metric.p50Ms} | ${metric.p95Ms} | ${metric.avgMs} | ${metric.errorRatePct} |`
    )
  }

  if (report.thresholdEvaluation) {
    lines.push("")
    lines.push("## Threshold Evaluation")
    lines.push("")
    lines.push(`- Status: ${report.thresholdEvaluation.passed ? "PASS" : "FAIL"}`)
    lines.push(`- Failed checks: ${report.thresholdEvaluation.failures.length}`)

    if (report.thresholdEvaluation.failures.length > 0) {
      lines.push("")
      for (const failure of report.thresholdEvaluation.failures) {
        lines.push(
          `- ${failure.endpoint}: ${failure.type} expected <= ${failure.expected} but got ${failure.actual}`
        )
      }
    }
  }

  lines.push("")
  return lines.join("\n")
}

async function loadThresholds() {
  try {
    const raw = await fs.readFile(path.resolve(thresholdFile), "utf8")
    return JSON.parse(raw)
  } catch (error) {
    console.warn(`Threshold file not loaded (${thresholdFile}). Continuing without threshold checks.`, error)
    return null
  }
}

function evaluateThresholds(metrics, thresholds) {
  if (!thresholds?.endpoints) {
    return null
  }

  const failures = []

  for (const metric of metrics) {
    const threshold = thresholds.endpoints[metric.endpoint]
    if (!threshold) {
      continue
    }

    if (typeof threshold.maxP95Ms === "number" && metric.p95Ms > threshold.maxP95Ms) {
      failures.push({
        endpoint: metric.endpoint,
        type: "p95Ms",
        expected: threshold.maxP95Ms,
        actual: metric.p95Ms,
      })
    }

    if (typeof threshold.maxErrorRatePct === "number" && metric.errorRatePct > threshold.maxErrorRatePct) {
      failures.push({
        endpoint: metric.endpoint,
        type: "errorRatePct",
        expected: threshold.maxErrorRatePct,
        actual: metric.errorRatePct,
      })
    }
  }

  return {
    passed: failures.length === 0,
    failures,
  }
}

async function main() {
  if (!Number.isFinite(runs) || runs <= 0) {
    throw new Error(`Invalid BENCHMARK_RUNS value: ${process.env.BENCHMARK_RUNS}`)
  }

  const sampleMap = new Map()
  for (const endpoint of DEFAULT_ENDPOINTS) {
    sampleMap.set(endpoint, [])
  }

  for (const endpoint of DEFAULT_ENDPOINTS) {
    console.info(`Running ${runs} probes for ${endpoint}`)

    for (let index = 0; index < runs; index += 1) {
      const sample = await runProbe(endpoint)
      sampleMap.get(endpoint).push(sample)
    }
  }

  const metrics = DEFAULT_ENDPOINTS.map((endpoint) => summarize(endpoint, sampleMap.get(endpoint)))
  const thresholds = await loadThresholds()
  const thresholdEvaluation = evaluateThresholds(metrics, thresholds)

  const createdAt = new Date().toISOString()
  const safeTimestamp = createdAt.replace(/[:.]/g, "-")
  const outDir = path.resolve(reportDir)
  await fs.mkdir(outDir, { recursive: true })

  const report = {
    createdAt,
    baseUrl,
    runsPerEndpoint: runs,
    metrics,
    thresholdEvaluation,
  }

  const jsonPath = path.join(outDir, `api-baseline-${safeTimestamp}.json`)
  const markdownPath = path.join(outDir, `api-baseline-${safeTimestamp}.md`)
  const latestJsonPath = path.join(outDir, "latest-api-baseline.json")
  const latestMarkdownPath = path.join(outDir, "latest-api-baseline.md")

  await fs.writeFile(jsonPath, JSON.stringify(report, null, 2), "utf8")
  await fs.writeFile(markdownPath, toMarkdown(report), "utf8")
  await fs.writeFile(latestJsonPath, JSON.stringify(report, null, 2), "utf8")
  await fs.writeFile(latestMarkdownPath, toMarkdown(report), "utf8")

  console.info(`Baseline report written: ${jsonPath}`)

  if (thresholdEvaluation && !thresholdEvaluation.passed) {
    console.error("Benchmark threshold evaluation failed.")
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error("Baseline benchmark script failed:", error)
  process.exitCode = 1
})
