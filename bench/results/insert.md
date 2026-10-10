# Benchmarks

## Baseline benchmark (no database)

- Date: 2026-10-10 (~00:47 UTC)
- Machine: Apple M5
- Bun: 1.4.2
- Duration: 10s per scenario
- Connections: 100
- Tool: oha, production build (`NODE_ENV=production`)

| Scenario | Route | req/s | Success | p99 |
| --- | --- | ---: | ---: | ---: |
| hono (REST) | `GET /health` | 178,711 | 100.00% | 1.16 ms |
| pylon (REST) | `GET /health` | 133,103 | 100.00% | 1.54 ms |
| pylon (GraphQL query `hello`) | `POST /graphql` | 15,352 | 100.00% | 13.23 ms |
| pylon (GraphQL query `searchBooks`) | `POST /graphql` | 11,556 | 100.00% | 58.09 ms |

<!-- insert-benchmark:start -->
## Insert benchmark (Postgres)

- Date: 2026-10-10T12:51:43.381Z
- Bun: 1.4.2
- Node: 20.20.2
- Duration: 10s per scenario
- Connections: 100
- Database pool size: 20 per server

| Scenario | req/s | Success | p50 | p99 | 2xx responses | Rows inserted |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| hono (REST) | 49,420 | 100.00% | 1.73 ms | 6.72 ms | 494,266 | 494,365 |
| node + express (REST) | 14,491 | 100.00% | 6.21 ms | 21.17 ms | 144,849 | 144,949 |
| pylon (REST) | 37,660 | 100.00% | 1.98 ms | 10.71 ms | 376,678 | 376,776 |
| pylon (GraphQL mutation) | 10,787 | 100.00% | 8.67 ms | 24.15 ms | 107,813 | 107,913 |
| hono + pothos (GraphQL mutation) | 17,871 | 100.00% | 5.48 ms | 8.71 ms | 178,655 | 178,754 |
<!-- insert-benchmark:end -->

<!-- zod-insert-benchmark:start -->
## Insert benchmark with Zod validation (Postgres)

- Date: 2026-10-10T12:52:36.203Z
- Bun: 1.4.2
- Node: 20.20.2
- Duration: 10s per scenario
- Connections: 100
- Database pool size: 20 per server

| Scenario | req/s | Success | p50 | p99 | 2xx responses | Rows inserted |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| hono + zod-validator (REST) | 50,288 | 100.00% | 1.79 ms | 6.64 ms | 502,936 | 503,033 |
| node + express + zod (REST) | 15,400 | 100.00% | 6.20 ms | 10.25 ms | 153,943 | 154,043 |
| pylon + zod-validator (REST) | 39,337 | 100.00% | 2.13 ms | 7.76 ms | 393,425 | 393,524 |
| pylon + zod (GraphQL mutation) | 10,536 | 100.00% | 8.09 ms | 34.04 ms | 105,301 | 105,401 |
| hono + pothos + zod (GraphQL mutation) | 17,068 | 100.00% | 5.64 ms | 10.60 ms | 170,635 | 170,735 |
<!-- zod-insert-benchmark:end -->
