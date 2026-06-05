# Memory Graph Engine

Production-oriented memory graph service for a Reflective Intelligence Platform.

## What it does

- ingests raw user reflections
- extracts memories, emotions, beliefs, values, goals, people, events, patterns, relationships, decisions, and insights
- stores the live graph in Neo4j
- stores backup records in PostgreSQL
- ranks, searches, and traverses the memory graph
- tracks graph evolution over time

## Run locally

1. Copy `.env.memory.example` to `.env`
2. Start PostgreSQL and Neo4j
3. Start the service:

```bash
npm run dev:memory
```

## API surface

- `GET /healthz`
- `POST /v1/reflections/ingest`
- `POST /v1/search`
- `GET /v1/graph/traverse`
- `GET /v1/memories/:id`
- `GET /v1/memories/:id/evolution`

