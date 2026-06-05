# Narrative Architecture

## Purpose

The Narrative Service is the identity layer of the platform. It does not store chat memory. It synthesizes repeated memories, patterns, emotions, and goals into evolving life narratives that can explain who the user is becoming.

## Pipeline

1. Normalize user text and supporting references.
2. Detect candidate narrative signals from definitions and support evidence.
3. Cluster the signal into an existing narrative or create a new one.
4. Update narrative frequency, confidence, start date, and support evidence.
5. Generate chapters and lifecycle state.
6. Persist an immutable occurrence and evolution snapshot.
7. Rank narratives for retrieval.
8. Produce monthly, quarterly, and annual reports.

## Core Components

- `src/detection/analysis.js`
  - extracts narrative signals, belief shifts, value shifts, and identity statements
- `src/detection/clustering.js`
  - maps signals onto stable narrative identities
- `src/detection/chapters.js`
  - generates narrative chapters and chapter status
- `src/detection/trends.js`
  - calculates emergence, growth, decline, and completion
- `src/reporting/reports.js`
  - produces narrative reports and identity evolution analysis
- `src/stores/memory-store.js`
  - in-memory development store
- `src/stores/postgres-store.js`
  - durable PostgreSQL store
- `src/pipeline/engine.js`
  - orchestrates ingest, ranking, retrieval, and reporting

## Design Notes

- Narrative rows are stable and user-specific.
- Occurrences are append-only for traceability.
- Reports are computed from time windows over the full history.
- Supporting memories, patterns, emotions, and goals are first-class evidence, not metadata afterthoughts.
