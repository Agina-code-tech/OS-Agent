# Pattern Detection Architecture

## Purpose

The Pattern Detection Service is the longitudinal behavior layer of the platform. It does not act like chatbot memory. It turns user history into durable pattern records that can be queried, ranked, and reported over time.

## Pipeline

1. Normalize incoming text and metadata.
2. Detect candidate signals using deterministic pattern definitions.
3. Cluster signals against existing user patterns.
4. Create or update pattern nodes.
5. Persist the current occurrence.
6. Append an evolution snapshot.
7. Recompute trend, reinforcement, and status.
8. Publish weekly, monthly, and quarterly summaries on demand.

## Core Components

- `src/detection/analysis.js`
  - extracts pattern signals from raw text
- `src/detection/clustering.js`
  - maps signals onto recurring user patterns
- `src/detection/trends.js`
  - calculates trend direction and resolution state
- `src/reporting/reports.js`
  - builds weekly, monthly, and quarterly reports
- `src/stores/memory-store.js`
  - in-memory development store
- `src/stores/postgres-store.js`
  - durable PostgreSQL store
- `src/pipeline/engine.js`
  - orchestration for ingest, search, retrieval, and reports

## Design Notes

- The service is stateless at runtime and relies on the store for persistence.
- Pattern identity is stable per user and canonical key.
- Evolution tracking is append-only so multi-year histories stay auditable.
- Search and reporting are intentionally read-friendly so the service can support very large histories.
