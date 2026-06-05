# Deployment Guide

## Local development

1. Start Neo4j and PostgreSQL.
2. Create the database and run migrations.
3. Set the environment variables from `.env.memory.example`.
4. Start the memory graph engine:

```bash
npm run dev:memory
```

## Recommended container layout

- `memory-graph-engine`
- `neo4j`
- `postgres`

## Production considerations

- Keep Neo4j and PostgreSQL in separate managed services.
- Use connection pooling for PostgreSQL.
- Use explicit transaction boundaries for graph writes.
- Log every extraction result and graph mutation with a stable correlation ID.
- Add retries only around transient network or database errors.
- Use read replicas or cache layers for search-heavy workloads.

## Scaling guidance

- Scale ingestion and search separately.
- Keep the orchestration layer stateless.
- Partition by `userId` in the application layer for large multi-year histories.
- Batch low-priority graph evolution writes.

