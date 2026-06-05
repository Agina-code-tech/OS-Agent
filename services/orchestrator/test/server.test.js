import test from "node:test";
import assert from "node:assert/strict";
import { OrchestrationEngine } from "../src/pipeline/engine.js";
import { createOrchestratorServer } from "../src/http/server.js";
import { createMockClient } from "./helpers.js";

test("serves orchestration endpoints", async () => {
  const engine = new OrchestrationEngine({
    clients: {
      memory: createMockClient({
        get: { "/healthz": { ok: true, payload: { ok: true } } },
        post: {
          "/v1/reflections/ingest": { ok: true, payload: { nodesUpserted: 1 } },
          "/v1/search": { ok: true, payload: { results: [] } },
        },
      }),
      pattern: createMockClient({
        get: { "/healthz": { ok: true, payload: { ok: true } }, "/v1/search": { ok: true, payload: { results: [] } } },
        post: { "/v1/patterns/ingest": { ok: true, payload: { detectedCount: 0 } } },
      }),
      narrative: createMockClient({
        get: { "/healthz": { ok: true, payload: { ok: true } }, "/v1/search": { ok: true, payload: { results: [] } } },
        post: { "/v1/narratives/ingest": { ok: true, payload: { detectedCount: 0 } } },
      }),
      research: createMockClient({
        get: { "/healthz": { ok: true, payload: { ok: true } }, "/v1/search": { ok: true, payload: { results: [] } } },
        post: { "/v1/retrieve": { ok: true, payload: { results: [] } } },
      }),
    },
    config: { topK: 3 },
  });

  const service = createOrchestratorServer({ engine, port: 0 });
  await service.listen();
  const address = service.server.address();
  assert.ok(address && typeof address === "object");
  const { port } = address;

  try {
    const health = await fetch(`http://127.0.0.1:${port}/healthz`);
    assert.equal(health.status, 200);
    const healthJson = await health.json();
    assert.equal(healthJson.ok, true);

    const reflection = await fetch(`http://127.0.0.1:${port}/v1/orchestrate/reflection`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: "user-1",
        text: "I am burnt out and need boundaries.",
      }),
    });
    assert.equal(reflection.status, 200);
    const reflectionJson = await reflection.json();
    assert.equal(reflectionJson.ok, true);
    assert.equal(reflectionJson.mode, "reflection");

    const search = await fetch(`http://127.0.0.1:${port}/v1/orchestrate/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: "user-1",
        query: "burnout and boundaries",
      }),
    });
    assert.equal(search.status, 200);
    const searchJson = await search.json();
    assert.equal(searchJson.ok, true);

    const recall = await fetch(`http://127.0.0.1:${port}/v1/orchestrate/recall`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: "user-1",
        query: "burnout",
      }),
    });
    assert.equal(recall.status, 200);
    const recallJson = await recall.json();
    assert.equal(recallJson.ok, true);
  } finally {
    await service.close();
  }
});

