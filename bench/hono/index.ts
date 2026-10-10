import {Hono} from 'hono'

import {
  createDatabasePool,
  insertBenchmarkEntry,
  type NewBenchmarkEntry
} from '../shared/database'

const pool = createDatabasePool()
const app = new Hono()

app.get('/health', context => context.json({status: 'ok'}))

app.post('/entries', async context => {
  const entry = await context.req.json<NewBenchmarkEntry>()
  const insertedEntry = await insertBenchmarkEntry(pool, 'hono', entry)
  return context.json(insertedEntry, 201)
})

export default {port: Number(process.env.PORT ?? 3101), fetch: app.fetch}
