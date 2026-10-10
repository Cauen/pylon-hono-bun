import SchemaBuilder from '@pothos/core'
import {GraphQLError} from 'graphql'
import {createYoga} from 'graphql-yoga'
import {Hono} from 'hono'
import type {ZodError} from 'zod'

import {
  createDatabasePool,
  insertBenchmarkEntry,
  type BenchmarkEntry
} from '../shared/database'
import {newBenchmarkEntrySchema} from '../shared/schemas'

const pool = createDatabasePool()

const builder = new SchemaBuilder<{Objects: {BenchmarkEntry: BenchmarkEntry}}>({})

builder.objectType('BenchmarkEntry', {
  fields: t => ({
    id: t.exposeInt('id'),
    framework: t.exposeString('framework'),
    name: t.exposeString('name'),
    message: t.exposeString('message'),
    createdAt: t.exposeString('createdAt')
  })
})

const NewBenchmarkEntryInput = builder.inputType('NewBenchmarkEntryInput', {
  fields: t => ({
    name: t.string({required: true}),
    message: t.string({required: true})
  })
})

const toBadUserInputError = (error: ZodError): GraphQLError => {
  const issues = error.issues.map(issue => ({
    path: issue.path.join('.'),
    message: issue.message
  }))
  return new GraphQLError('Invalid input', {
    extensions: {code: 'BAD_USER_INPUT', http: {status: 400}, issues}
  })
}

builder.queryType({
  fields: t => ({
    ping: t.string({resolve: () => 'pong'})
  })
})

builder.mutationType({
  fields: t => ({
    createEntry: t.field({
      type: 'BenchmarkEntry',
      args: {entry: t.arg({type: NewBenchmarkEntryInput, required: true})},
      resolve: (_root, {entry}) =>
        insertBenchmarkEntry(pool, 'pothos-graphql', entry)
    }),
    createValidatedEntry: t.field({
      type: 'BenchmarkEntry',
      args: {entry: t.arg({type: NewBenchmarkEntryInput, required: true})},
      resolve: (_root, {entry}) => {
        const validation = newBenchmarkEntrySchema.safeParse(entry)
        if (!validation.success) throw toBadUserInputError(validation.error)
        return insertBenchmarkEntry(pool, 'pothos-graphql-zod', validation.data)
      }
    })
  })
})

const yoga = createYoga({
  schema: builder.toSchema(),
  graphqlEndpoint: '/graphql',
  graphiql: false,
  landingPage: false
})

const app = new Hono()
  .get('/health', context => context.json({status: 'ok'}))
  .on(['GET', 'POST'], '/graphql', context => yoga.fetch(context.req.raw))

export default {port: Number(process.env.PORT ?? 3103), fetch: app.fetch}
