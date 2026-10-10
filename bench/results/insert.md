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

- Date: 2026-10-10T00:57:38.761Z
- Bun: 1.4.2
- Duration: 10s per scenario
- Connections: 100
- Database pool size: 20 per server

| Scenario | req/s | Success | p50 | p99 | 2xx responses | Rows inserted |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| hono (REST) | 55,213 | 100.00% | 1.61 ms | 6.49 ms | 552,274 | 552,374 |
| pylon (REST) | 47,215 | 100.00% | 1.89 ms | 6.85 ms | 472,228 | 472,327 |
| pylon (GraphQL mutation) | 10,792 | 100.00% | 8.17 ms | 23.71 ms | 107,856 | 107,956 |
<!-- insert-benchmark:end -->
