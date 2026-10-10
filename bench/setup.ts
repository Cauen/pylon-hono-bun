import {createBenchmarkTable, createDatabasePool} from './shared/database'

const pool = createDatabasePool()

await createBenchmarkTable(pool)
await pool.end()

console.log('Table "bun-benchmark" is ready')
