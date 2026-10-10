import {
  createMutationBody,
  HONO_SERVER,
  PYLON_SERVER,
  REST_BODY,
  runBenchmarkSuite
} from './shared/runner'

await runBenchmarkSuite({
  sectionId: 'zod-insert-benchmark',
  title: 'Insert benchmark with Zod validation (Postgres)',
  scenarios: [
    {
      name: 'hono + zod-validator (REST)',
      framework: 'hono-zod',
      ...HONO_SERVER,
      path: '/zod/entries',
      body: REST_BODY
    },
    {
      name: 'pylon + zod-validator (REST)',
      framework: 'pylon-rest-zod',
      ...PYLON_SERVER,
      path: '/zod/entries',
      body: REST_BODY
    },
    {
      name: 'pylon + zod (GraphQL mutation)',
      framework: 'pylon-graphql-zod',
      ...PYLON_SERVER,
      path: '/graphql',
      body: createMutationBody('createValidatedEntry')
    }
  ]
})
