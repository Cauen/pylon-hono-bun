import path from 'node:path'

import type {Pool} from 'pg'

import {
  countEntriesByFramework,
  createBenchmarkTable,
  createDatabasePool,
  truncateBenchmarkTable,
  type NewBenchmarkEntry
} from './shared/database'

interface Scenario {
  name: string
  framework: string
  serverEntry: string
  serverDirectory: string
  port: number
  path: string
  body: string
}

interface LoadTestReport {
  summary: {successRate: number; requestsPerSec: number}
  latencyPercentiles: {p50: number | null; p99: number | null}
  statusCodeDistribution: Record<string, number>
}

interface ScenarioResult {
  name: string
  requestsPerSecond: number
  successRate: number
  latencyP50Ms: number
  latencyP99Ms: number
  createdResponses: number
}

const BENCH_DIRECTORY = import.meta.dir
const PROJECT_DIRECTORY = path.resolve(BENCH_DIRECTORY, '..')
const PYLON_DIRECTORY = path.join(BENCH_DIRECTORY, 'pylon')
const HONO_DIRECTORY = path.join(BENCH_DIRECTORY, 'hono')
const RESULTS_FILE = path.join(BENCH_DIRECTORY, 'results', 'insert.md')
const PYLON_CLI = path.join(PROJECT_DIRECTORY, 'node_modules', '.bin', 'pylon')
const INSERT_SECTION_START = '<!-- insert-benchmark:start -->'
const INSERT_SECTION_END = '<!-- insert-benchmark:end -->'

const DURATION = process.env.BENCH_DURATION ?? '10s'
const CONNECTIONS = process.env.BENCH_CONNECTIONS ?? '100'
const SERVER_READY_ATTEMPTS = 50
const SERVER_READY_INTERVAL_MS = 100

const SAMPLE_ENTRY: NewBenchmarkEntry = {name: 'bun', message: 'hello world'}

const CREATE_ENTRY_MUTATION = `
  mutation CreateEntry($entry: NewBenchmarkEntryInput!) {
    createEntry(entry: $entry) { id framework name message createdAt }
  }
`

const restBody = JSON.stringify(SAMPLE_ENTRY)
const graphqlBody = JSON.stringify({
  query: CREATE_ENTRY_MUTATION,
  variables: {entry: SAMPLE_ENTRY}
})

const SCENARIOS: Scenario[] = [
  {
    name: 'hono (REST)',
    framework: 'hono',
    serverEntry: 'index.ts',
    serverDirectory: HONO_DIRECTORY,
    port: 3101,
    path: '/entries',
    body: restBody
  },
  {
    name: 'pylon (REST)',
    framework: 'pylon-rest',
    serverEntry: '.pylon/index.js',
    serverDirectory: PYLON_DIRECTORY,
    port: 3102,
    path: '/entries',
    body: restBody
  },
  {
    name: 'pylon (GraphQL mutation)',
    framework: 'pylon-graphql',
    serverEntry: '.pylon/index.js',
    serverDirectory: PYLON_DIRECTORY,
    port: 3102,
    path: '/graphql',
    body: graphqlBody
  }
]

const sleep = (milliseconds: number) => Bun.sleep(milliseconds)

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
  await sleep(SERVER_READY_INTERVAL_MS)
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
  name: scenario.name,
  requestsPerSecond: report.summary.requestsPerSec,
  successRate: report.summary.successRate,
  latencyP50Ms: toMilliseconds(report.latencyPercentiles.p50),
  latencyP99Ms: toMilliseconds(report.latencyPercentiles.p99),
  createdResponses:
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

const formatResultsTable = (
  results: ScenarioResult[],
  insertedRowsByFramework: Record<string, number>
): string => {
  const header = [
    '| Scenario | req/s | Success | p50 | p99 | 2xx responses | Rows inserted |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |'
  ]
  const rows = results.map((result, index) => {
    const framework = SCENARIOS[index]?.framework ?? ''
    const insertedRows = insertedRowsByFramework[framework] ?? 0
    return `| ${result.name} | ${formatNumber(result.requestsPerSecond)} | ${formatNumber(result.successRate * 100, 2)}% | ${formatNumber(result.latencyP50Ms, 2)} ms | ${formatNumber(result.latencyP99Ms, 2)} ms | ${formatNumber(result.createdResponses)} | ${formatNumber(insertedRows)} |`
  })
  return [...header, ...rows].join('\n')
}

const formatReport = (table: string): string =>
  [
    '## Insert benchmark (Postgres)',
    '',
    `- Date: ${new Date().toISOString()}`,
    `- Bun: ${Bun.version}`,
    `- Duration: ${DURATION} per scenario`,
    `- Connections: ${CONNECTIONS}`,
    `- Database pool size: ${process.env.DB_POOL_SIZE ?? 20} per server`,
    '',
    table
  ].join('\n')

const wrapInsertSection = (report: string): string =>
  [INSERT_SECTION_START, report, INSERT_SECTION_END].join('\n')

const mergeInsertSection = (existingContent: string, report: string): string => {
  const wrappedSection = wrapInsertSection(report)
  const sectionStart = existingContent.indexOf(INSERT_SECTION_START)
  const sectionEnd = existingContent.indexOf(INSERT_SECTION_END)
  const hasInsertSection = sectionStart >= 0 && sectionEnd > sectionStart

  if (!hasInsertSection) {
    const contentBefore = existingContent.trimEnd()
    const separator = contentBefore.length > 0 ? '\n\n' : ''
    return `${contentBefore}${separator}${wrappedSection}\n`
  }

  const contentBefore = existingContent.slice(0, sectionStart)
  const contentAfter = existingContent.slice(sectionEnd + INSERT_SECTION_END.length)
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

const pool = createDatabasePool()

try {
  await prepareDatabase(pool)
  await buildPylonServer()

  const results = await runScenariosSequentially(SCENARIOS)
  const insertedRowsByFramework = await countEntriesByFramework(pool)
  const report = formatReport(
    formatResultsTable(results, insertedRowsByFramework)
  )

  const existingResults = await readResultsFile()
  await Bun.write(RESULTS_FILE, mergeInsertSection(existingResults, report))
  console.log(`\n${report}\nSaved to ${path.relative(PROJECT_DIRECTORY, RESULTS_FILE)}`)
} finally {
  await pool.end()
}
