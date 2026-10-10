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

- Date: 2026-10-10T12:27:14.361Z
- Bun: 1.4.2
- Duration: 10s per scenario
- Connections: 100
- Database pool size: 20 per server

| Scenario | req/s | Success | p50 | p99 | 2xx responses | Rows inserted |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| hono (REST) | 52,213 | 100.00% | 1.66 ms | 6.66 ms | 522,322 | 522,422 |
| pylon (REST) | 47,076 | 100.00% | 1.91 ms | 6.63 ms | 470,898 | 470,998 |
| pylon (GraphQL mutation) | 10,109 | 100.00% | 9.31 ms | 18.96 ms | 101,026 | 101,072 |
| hono + pothos (GraphQL mutation) | 17,074 | 100.00% | 5.62 ms | 10.35 ms | 170,710 | 170,809 |
<!-- insert-benchmark:end -->

<!-- zod-insert-benchmark:start -->
## Insert benchmark with Zod validation (Postgres)

- Date: 2026-10-10T12:28:02.150Z
- Bun: 1.4.2
- Duration: 10s per scenario
- Connections: 100
- Database pool size: 20 per server

| Scenario | req/s | Success | p50 | p99 | 2xx responses | Rows inserted |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| hono + zod-validator (REST) | 50,159 | 100.00% | 1.78 ms | 6.66 ms | 501,663 | 501,763 |
| pylon + zod-validator (REST) | 43,555 | 100.00% | 2.10 ms | 6.65 ms | 435,586 | 435,684 |
| pylon + zod (GraphQL mutation) | 10,220 | 100.00% | 8.24 ms | 34.02 ms | 102,127 | 102,226 |
| hono + pothos + zod (GraphQL mutation) | 17,452 | 100.00% | 5.63 ms | 8.60 ms | 174,482 | 174,582 |
<!-- zod-insert-benchmark:end -->
