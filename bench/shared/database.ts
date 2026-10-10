import {Pool} from 'pg'

const BENCHMARK_TABLE = '"bun-benchmark"'
const DEFAULT_DATABASE_URL = 'postgres://localhost:5432/postgres'
const DEFAULT_POOL_SIZE = 20

export interface NewBenchmarkEntry {
  name: string
  message: string
}

export interface BenchmarkEntry {
  id: number
  framework: string
  name: string
  message: string
  createdAt: string
}

interface BenchmarkEntryRow {
  id: number
  framework: string
  name: string
  message: string
  created_at: Date
}

interface FrameworkCountRow {
  framework: string
  total: number
}

export const createDatabasePool = (): Pool =>
  new Pool({
    connectionString: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
    max: Number(process.env.DB_POOL_SIZE ?? DEFAULT_POOL_SIZE)
  })

export const createBenchmarkTable = async (pool: Pool): Promise<void> => {
  await pool.query(`
    create table if not exists ${BENCHMARK_TABLE} (
      id integer generated always as identity primary key,
      framework text not null,
      name text not null,
      message text not null,
      created_at timestamptz not null default now()
    )
  `)
}

export const truncateBenchmarkTable = async (pool: Pool): Promise<void> => {
  await pool.query(`truncate table ${BENCHMARK_TABLE} restart identity`)
}

const toBenchmarkEntry = (row: BenchmarkEntryRow): BenchmarkEntry => ({
  id: row.id,
  framework: row.framework,
  name: row.name,
  message: row.message,
  createdAt: row.created_at.toISOString()
})

export const insertBenchmarkEntry = async (
  pool: Pool,
  framework: string,
  entry: NewBenchmarkEntry
): Promise<BenchmarkEntry> => {
  const result = await pool.query<BenchmarkEntryRow>(
    `insert into ${BENCHMARK_TABLE} (framework, name, message)
     values ($1, $2, $3)
     returning id, framework, name, message, created_at`,
    [framework, entry.name, entry.message]
  )
  const insertedRow = result.rows[0] as BenchmarkEntryRow
  return toBenchmarkEntry(insertedRow)
}

export const countEntriesByFramework = async (
  pool: Pool
): Promise<Record<string, number>> => {
  const result = await pool.query<FrameworkCountRow>(
    `select framework, count(*)::int as total
     from ${BENCHMARK_TABLE}
     group by framework`
  )
  return Object.fromEntries(result.rows.map(row => [row.framework, row.total]))
}
