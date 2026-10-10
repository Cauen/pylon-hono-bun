import {zValidator} from '@hono/zod-validator'
import {app, ServiceError} from '@getcronit/pylon'
import type {ZodError} from 'zod'

import {
  createDatabasePool,
  insertBenchmarkEntry,
  type NewBenchmarkEntry
} from '../../shared/database'
import {newBenchmarkEntrySchema} from '../../shared/schemas'

const pool = createDatabasePool()

const toBadUserInputError = (error: ZodError): ServiceError => {
  const issues = error.issues.map(issue => ({
    path: issue.path.join('.'),
    message: issue.message
  }))
  return new ServiceError('Invalid input', {
    code: 'BAD_USER_INPUT',
    statusCode: 400,
    details: {issues}
  })
}

export const graphql = {
  Query: {
    ping: () => 'pong'
  },
  Mutation: {
    createEntry: (entry: NewBenchmarkEntry) =>
      insertBenchmarkEntry(pool, 'pylon-graphql', entry),
    createValidatedEntry: (entry: NewBenchmarkEntry) => {
      const validation = newBenchmarkEntrySchema.safeParse(entry)
      if (!validation.success) throw toBadUserInputError(validation.error)
      return insertBenchmarkEntry(pool, 'pylon-graphql-zod', validation.data)
    }
  }
}

app.get('/health', context => context.json({status: 'ok'}))

app.post('/entries', async context => {
  const entry = await context.req.json<NewBenchmarkEntry>()
  const insertedEntry = await insertBenchmarkEntry(pool, 'pylon-rest', entry)
  return context.json(insertedEntry, 201)
})

app.post(
  '/zod/entries',
  zValidator('json', newBenchmarkEntrySchema),
  async context => {
    const entry = context.req.valid('json')
    const insertedEntry = await insertBenchmarkEntry(pool, 'pylon-rest-zod', entry)
    return context.json(insertedEntry, 201)
  }
)

export default app
