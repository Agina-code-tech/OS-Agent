# Testing Strategy

## Coverage goals

- deterministic signal detection
- pattern clustering and identity stability
- frequency and trend calculations
- report generation for weekly/monthly/quarterly windows
- HTTP endpoint smoke coverage

## Test layers

1. Unit tests for detection math and report logic.
2. Engine tests for ingest and trend evolution.
3. HTTP smoke tests for the service routes.

## What to verify

- recurring text creates stable pattern ids
- repeated inputs increase frequency
- repeated windows shift trend direction correctly
- reports classify patterns into the right buckets
- search works in both in-memory and Postgres-backed modes
