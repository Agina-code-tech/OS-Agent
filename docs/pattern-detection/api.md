# Pattern Detection API

## `GET /healthz`

Returns service and store health.

## `POST /v1/patterns/ingest`

Ingests a single input or a batch of inputs.

Input fields:

- `userId`
- `text`, `content`, or `transcript`
- `sourceType`
- `sourceId`
- `occurredAt`
- `metadata`

## `GET /v1/patterns?userId=...`

Lists detected patterns with optional filters:

- `family`
- `status`
- `sourceType`

## `GET /v1/patterns/:id?userId=...`

Returns one pattern.

## `GET /v1/patterns/:id/occurrences?userId=...`

Returns all recorded occurrences for a pattern.

## `GET /v1/patterns/:id/evolution?userId=...`

Returns evolution snapshots for a pattern.

## `GET /v1/search?userId=...&q=...`

Searches patterns by label, key, family, and frequency-weighted ranking.

## `GET /v1/reports/weekly?userId=...`
## `GET /v1/reports/monthly?userId=...`
## `GET /v1/reports/quarterly?userId=...`

Returns report summaries for the selected time window.
