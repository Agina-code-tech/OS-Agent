# API Endpoints

## Health

- `GET /healthz`

## Ingestion

- `POST /v1/reflections/ingest`

Request:

```json
{
  "userId": "user_123",
  "reflectionId": "optional_reflection_id",
  "text": "I felt blocked at work because I don't trust my manager..."
}
```

Response:

```json
{
  "ok": true,
  "reflectionId": "ref_...",
  "graphRevision": 12,
  "nodesUpserted": 8,
  "edgesUpserted": 11,
  "summary": { }
}
```

## Search

- `POST /v1/search`

Request:

```json
{
  "userId": "user_123",
  "query": "times I felt blocked at work",
  "topK": 10
}
```

## Traversal

- `GET /v1/graph/traverse?userId=user_123&nodeId=mem_123&depth=2`

## Memory read

- `GET /v1/memories/:id?userId=user_123`

## Evolution

- `GET /v1/memories/:id/evolution?userId=user_123`

