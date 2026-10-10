import path from 'node:path'

import type {Pool} from 'pg'

import {
  countEntriesByFramework,
  createBenchmarkTable,
  createDatabasePool,
  truncateBenchmarkTable,
  type NewBenchmarkEntry
} from './database'

export interface Scenario {
  name: string
  framework: string
  serverEntry: string
  serverDirectory: string
  port: number
  path: string
  body: string
}

export interface BenchmarkSuite {
  sectionId: string
  title: string
  scenarios: Scenario[]
}

interface LoadTestReport {
  summary: {successRate: number; requestsPerSec: number}
  latencyPercentiles: {p50: number | null; p99: number | null}
  statusCodeDistribution: Record<string, number>
}

interface ScenarioResult {
  scenario: Scenario
  requestsPerSecond: number
  successRate: number
  latencyP50Ms: number
  latencyP99Ms: number
  successfulResponses: number
}

const BENCH_DIRECTORY = path.resolve(import.meta.dir, '..')
const PROJECT_DIRECTORY = path.resolve(BENCH_DIRECTORY, '..')
const RESULTS_FILE = path.join(BENCH_DIRECTORY, 'results', 'insert.md')
const PYLON_CLI = path.join(PROJECT_DIRECTORY, 'node_modules', '.bin', 'pylon')

export const PYLON_DIRECTORY = path.join(BENCH_DIRECTORY, 'pylon')
export const HONO_DIRECTORY = path.join(BENCH_DIRECTORY, 'hono')
export const HONO_SERVER = {serverEntry: 'index.ts', serverDirectory: HONO_DIRECTORY, port: 3101}
export const PYLON_SERVER = {serverEntry: '.pylon/index.js', serverDirectory: PYLON_DIRECTORY, port: 3102}

const DURATION = process.env.BENCH_DURATION ?? '10s'
const CONNECTIONS = process.env.BENCH_CONNECTIONS ?? '100'
const POOL_SIZE = process.env.DB_POOL_SIZE ?? '20'
const SERVER_READY_ATTEMPTS = 50
const SERVER_READY_INTERVAL_MS = 100

const SAMPLE_ENTRY: NewBenchmarkEntry = {name: 'bun', message: 'hello world'}

export const REST_BODY = JSON.stringify(SAMPLE_ENTRY)

export const createMutationBody = (mutationName: string): string => {
  const mutation = `
    mutation CreateEntry($entry: NewBenchmarkEntryInput!) {
      ${mutationName}(entry: $entry) { id framework name message createdAt }
    }
  `
  return JSON.stringify({query: mutation, variables: {entry: SAMPLE_ENTRY}})
}

const isServerReady = async (port: number): Promise<boolean> => {
  const healthResponse = await fetch(`http://127.0.0.1:${port}/health`).catch(
    () => null
  )
  return healthResponse?.ok ?? false
}

const waitForServer = async (
  port: number,
  remainingAttempts = SERVER_READY_ATTEMPTS
): Promise<void> => {
  const isReady = await isServerReady(port)
  if (isReady) return
  if (remainingAttempts <= 0) {
    throw new Error(`Server on port ${port} did not start in time`)
  }
  await Bun.sleep(SERVER_READY_INTERVAL_MS)
  return waitForServer(port, remainingAttempts - 1)
}

const buildPylonServer = async (): Promise<void> => {
  const buildProcess = Bun.spawn([PYLON_CLI, 'build'], {
    cwd: PYLON_DIRECTORY,
    stdout: 'inherit',
    stderr: 'inherit'
  })
  const exitCode = await buildProcess.exited
  if (exitCode !== 0) throw new Error('Pylon build failed')
}

const startServer = (scenario: Scenario) =>
  Bun.spawn(['bun', 'run', scenario.serverEntry], {
    cwd: scenario.serverDirectory,
    env: {...process.env, NODE_ENV: 'production', PORT: String(scenario.port)},
    stdout: 'ignore',
    stderr: 'ignore'
  })

const runLoadTest = async (scenario: Scenario): Promise<LoadTestReport> => {
  const targetUrl = `http://127.0.0.1:${scenario.port}${scenario.path}`
  const loadTestProcess = Bun.spawn(
    [
      'oha',
      '-z',
      DURATION,
      '-c',
      CONNECTIONS,
      '--no-tui',
      '--output-format',
      'json',
      '-m',
      'POST',
      '-H',
      'content-type: application/json',
      '-d',
      scenario.body,
      targetUrl
    ],
    {stdout: 'pipe', stderr: 'inherit'}
  )
  const rawReport = await new Response(loadTestProcess.stdout).text()
  return JSON.parse(rawReport) as LoadTestReport
}

const toMilliseconds = (seconds: number | null): number => (seconds ?? 0) * 1000

const toScenarioResult = (
  scenario: Scenario,
  report: LoadTestReport
): ScenarioResult => ({
  scenario,
  requestsPerSecond: report.summary.requestsPerSec,
  successRate: report.summary.successRate,
  latencyP50Ms: toMilliseconds(report.latencyPercentiles.p50),
  latencyP99Ms: toMilliseconds(report.latencyPercentiles.p99),
  successfulResponses:
    (report.statusCodeDistribution['201'] ?? 0) +
    (report.statusCodeDistribution['200'] ?? 0)
})

const runScenario = async (scenario: Scenario): Promise<ScenarioResult> => {
  console.log(`\n▶ ${scenario.name}`)
  const server = startServer(scenario)
  try {
    await waitForServer(scenario.port)
    const report = await runLoadTest(scenario)
    const result = toScenarioResult(scenario, report)
    console.log(
      `  ${Math.round(result.requestsPerSecond).toLocaleString('en-US')} req/s`
    )
    return result
  } finally {
    server.kill()
    await server.exited
  }
}

const runScenariosSequentially = (scenarios: Scenario[]) =>
  scenarios.reduce<Promise<ScenarioResult[]>>(
    async (previousResults, scenario) => [
      ...(await previousResults),
      await runScenario(scenario)
    ],
    Promise.resolve([])
  )

const formatNumber = (value: number, fractionDigits = 0) =>
  value.toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  })

const formatResultRow = (
  result: ScenarioResult,
  insertedRowsByFramework: Record<string, number>
): string => {
  const insertedRows = insertedRowsByFramework[result.scenario.framework] ?? 0
  const cells = [
    result.scenario.name,
    formatNumber(result.requestsPerSecond),
    `${formatNumber(result.successRate * 100, 2)}%`,
    `${formatNumber(result.latencyP50Ms, 2)} ms`,
    `${formatNumber(result.latencyP99Ms, 2)} ms`,
    formatNumber(result.successfulResponses),
    formatNumber(insertedRows)
  ]
  return `| ${cells.join(' | ')} |`
}

const formatResultsTable = (
  results: ScenarioResult[],
  insertedRowsByFramework: Record<string, number>
): string => {
  const header = [
    '| Scenario | req/s | Success | p50 | p99 | 2xx responses | Rows inserted |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |'
  ]
  const rows = results.map(result =>
    formatResultRow(result, insertedRowsByFramework)
  )
  return [...header, ...rows].join('\n')
}

const formatReport = (title: string, table: string): string =>
  [
    `## ${title}`,
    '',
    `- Date: ${new Date().toISOString()}`,
    `- Bun: ${Bun.version}`,
    `- Duration: ${DURATION} per scenario`,
    `- Connections: ${CONNECTIONS}`,
    `- Database pool size: ${POOL_SIZE} per server`,
    '',
    table
  ].join('\n')

const toSectionMarkers = (sectionId: string) => ({
  start: `<!-- ${sectionId}:start -->`,
  end: `<!-- ${sectionId}:end -->`
})

const mergeSection = (
  existingContent: string,
  sectionId: string,
  report: string
): string => {
  const markers = toSectionMarkers(sectionId)
  const wrappedSection = [markers.start, report, markers.end].join('\n')
  const sectionStart = existingContent.indexOf(markers.start)
  const sectionEnd = existingContent.indexOf(markers.end)
  const hasSection = sectionStart >= 0 && sectionEnd > sectionStart

  if (!hasSection) {
    const contentBefore = existingContent.trimEnd()
    const separator = contentBefore.length > 0 ? '\n\n' : ''
    return `${contentBefore}${separator}${wrappedSection}\n`
  }

  const contentBefore = existingContent.slice(0, sectionStart)
  const contentAfter = existingContent.slice(sectionEnd + markers.end.length)
  return `${contentBefore}${wrappedSection}${contentAfter}`
}

const readResultsFile = async (): Promise<string> => {
  const resultsFile = Bun.file(RESULTS_FILE)
  const fileExists = await resultsFile.exists()
  return fileExists ? resultsFile.text() : ''
}

const prepareDatabase = async (pool: Pool): Promise<void> => {
  await createBenchmarkTable(pool)
  await truncateBenchmarkTable(pool)
}

export const runBenchmarkSuite = async (suite: BenchmarkSuite): Promise<void> => {
  const pool = createDatabasePool()

  try {
    await prepareDatabase(pool)
    await buildPylonServer()

    const results = await runScenariosSequentially(suite.scenarios)
    const insertedRowsByFramework = await countEntriesByFramework(pool)
    const table = formatResultsTable(results, insertedRowsByFramework)
    const report = formatReport(suite.title, table)

    const existingResults = await readResultsFile()
    const mergedResults = mergeSection(existingResults, suite.sectionId, report)
    await Bun.write(RESULTS_FILE, mergedResults)

    const relativeResultsPath = path.relative(PROJECT_DIRECTORY, RESULTS_FILE)
    console.log(`\n${report}\n\nSaved to ${relativeResultsPath}`)
  } finally {
    await pool.end()
  }
}
