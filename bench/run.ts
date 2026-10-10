import {
  createMutationBody,
  EXPRESS_SERVER,
  HONO_SERVER,
  POTHOS_SERVER,
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
      name: 'node + express (REST)',
      framework: 'express',
      ...EXPRESS_SERVER,
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
    },
    {
      name: 'hono + pothos (GraphQL mutation)',
      framework: 'pothos-graphql',
      ...POTHOS_SERVER,
      path: '/graphql',
      body: createMutationBody('createEntry')
    }
  ]
})
