# Orchestration Service

The orchestrator is the coordination layer that keeps the four specialist services independent while still making them feel like one product.

## Responsibilities

- normalize incoming user reflections and queries
- route each request to the right specialist service
- aggregate memory graph, pattern detection, narrative, and research outputs
- apply lightweight retries and service-failure isolation
- return a single unified response for the UI

## Service map

- `memory-graph-engine` on `http://127.0.0.1:8080`
- `pattern-detection-service` on `http://127.0.0.1:8090`
- `narrative-service` on `http://127.0.0.1:8091`
- `research-rag-engine` on `http://127.0.0.1:8092`

## Endpoints

- `GET /healthz`
- `POST /v1/orchestrate/reflection`
- `POST /v1/orchestrate/search`
- `POST /v1/orchestrate/recall`

## Environment

- `ORCHESTRATOR_PORT`
- `ORCHESTRATOR_MEMORY_GRAPH_URL`
- `ORCHESTRATOR_PATTERN_URL`
- `ORCHESTRATOR_NARRATIVE_URL`
- `ORCHESTRATOR_RESEARCH_URL`
- `ORCHESTRATOR_TIMEOUT_MS`
- `ORCHESTRATOR_RETRIES`

