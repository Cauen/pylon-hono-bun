import {app} from '@getcronit/pylon'

import {
  createDatabasePool,
  insertBenchmarkEntry,
  type NewBenchmarkEntry
} from '../../shared/database'

const pool = createDatabasePool()

export const graphql = {
  Query: {
    ping: () => 'pong'
  },
  Mutation: {
    createEntry: (entry: NewBenchmarkEntry) =>
      insertBenchmarkEntry(pool, 'pylon-graphql', entry)
  }
}

app.get('/health', context => context.json({status: 'ok'}))

app.post('/entries', async context => {
  const entry = await context.req.json<NewBenchmarkEntry>()
  const insertedEntry = await insertBenchmarkEntry(pool, 'pylon-rest', entry)
  return context.json(insertedEntry, 201)
})

export default app
