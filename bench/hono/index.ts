import {zValidator} from '@hono/zod-validator'
import {Hono} from 'hono'

import {
  createDatabasePool,
  insertBenchmarkEntry,
  type NewBenchmarkEntry
} from '../shared/database'
import {newBenchmarkEntrySchema} from '../shared/schemas'

const pool = createDatabasePool()

const app = new Hono()
  .get('/health', context => context.json({status: 'ok'}))
  .post('/entries', async context => {
    const entry = await context.req.json<NewBenchmarkEntry>()
    const insertedEntry = await insertBenchmarkEntry(pool, 'hono', entry)
    return context.json(insertedEntry, 201)
  })
  .post(
    '/zod/entries',
    zValidator('json', newBenchmarkEntrySchema),
    async context => {
      const entry = context.req.valid('json')
      const insertedEntry = await insertBenchmarkEntry(pool, 'hono-zod', entry)
      return context.json(insertedEntry, 201)
    }
  )

export type AppType = typeof app

export default {port: Number(process.env.PORT ?? 3101), fetch: app.fetch}
