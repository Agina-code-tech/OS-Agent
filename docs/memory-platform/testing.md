# Testing Strategy

## Unit tests

- extraction normalization
- node canonicalization
- edge scoring
- memory ranking
- search scoring

## Repository tests

- Cypher generation
- SQL persistence statements
- temporal update logic

## Service tests

- ingestion success path
- fallback extractor path
- invalid payload rejection
- traversal and search API responses

## Load and scale tests

- high-volume ingest batches
- multi-year query windows
- repeated node/edge merges

## Acceptance criteria

- The same reflection ingested twice should not create duplicate canonical nodes.
- A semantically similar reflection should strengthen existing edges instead of fragmenting the graph.
- A search query should return ranked memories and a connected subgraph.

