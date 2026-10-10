import {
  createMutationBody,
  HONO_SERVER,
  PYLON_SERVER,
  REST_BODY,
  runBenchmarkSuite
} from './shared/runner'

await runBenchmarkSuite({
  sectionId: 'insert-benchmark',
  title: 'Insert benchmark (Postgres)',
  scenarios: [
    {
      name: 'hono (REST)',
      framework: 'hono',
      ...HONO_SERVER,
      path: '/entries',
      body: REST_BODY
    },
    {
      name: 'pylon (REST)',
      framework: 'pylon-rest',
      ...PYLON_SERVER,
      path: '/entries',
      body: REST_BODY
    },
    {
      name: 'pylon (GraphQL mutation)',
      framework: 'pylon-graphql',
      ...PYLON_SERVER,
      path: '/graphql',
      body: createMutationBody('createEntry')
    }
  ]
})
