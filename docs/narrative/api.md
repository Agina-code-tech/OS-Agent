# Narrative API

## `GET /healthz`

Returns service and store health.

## `POST /v1/narratives/ingest`

Ingests a single narrative input or a batch of inputs.

Input fields:

- `userId`
- `text`, `content`, `summary`, or `narrative`
- `sourceType`
- `sourceId`
- `occurredAt`
- `metadata`
- `supportingMemories`
- `supportingPatterns`
- `supportingEmotions`
- `supportingGoals`

## `GET /v1/narratives?userId=...`

Lists narratives with optional filters:

- `family`
- `status`
- `theme`
- `sourceType`

## `GET /v1/narratives/:id?userId=...`

Returns one narrative.

## `GET /v1/narratives/:id/occurrences?userId=...`

Returns all recorded occurrences for a narrative.

## `GET /v1/narratives/:id/evolution?userId=...`

Returns evolution snapshots for a narrative.

## `GET /v1/occurrences?userId=...&narrativeId=...`

Returns all occurrences or occurrences for a single narrative.

## `GET /v1/search?userId=...&q=...`

Searches narratives by label, key, family, summary, themes, and frequency-weighted ranking.

## `GET /v1/reports/monthly?userId=...`
## `GET /v1/reports/quarterly?userId=...`
## `GET /v1/reports/annual?userId=...`

Returns narrative reports and identity evolution analysis for the requested period.

## `GET /v1/identity/summary?userId=...`

Returns an identity summary that answers who the user is becoming.
