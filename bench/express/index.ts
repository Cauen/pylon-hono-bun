import express, {type RequestHandler} from 'express'
import type {ZodType} from 'zod'

import {
  createDatabasePool,
  insertBenchmarkEntry,
  type NewBenchmarkEntry
} from '../shared/database'
import {newBenchmarkEntrySchema} from '../shared/schemas'

const pool = createDatabasePool()

const validateBody =
  (schema: ZodType): RequestHandler =>
  (request, response, next) => {
    const validation = schema.safeParse(request.body)
    if (!validation.success) {
      response.status(400).json({success: false, error: validation.error.issues})
      return
    }
    request.body = validation.data
    next()
  }

const app = express()
  .disable('x-powered-by')
  .disable('etag')
  .use(express.json())
  .get('/health', (_request, response) => {
    response.json({status: 'ok'})
  })
  .post('/entries', async (request, response) => {
    const entry = request.body as NewBenchmarkEntry
    const insertedEntry = await insertBenchmarkEntry(pool, 'express', entry)
    response.status(201).json(insertedEntry)
  })
  .post(
    '/zod/entries',
    validateBody(newBenchmarkEntrySchema),
    async (request, response) => {
      const entry = request.body as NewBenchmarkEntry
      const insertedEntry = await insertBenchmarkEntry(pool, 'express-zod', entry)
      response.status(201).json(insertedEntry)
    }
  )

app.listen(Number(process.env.PORT ?? 3104))
