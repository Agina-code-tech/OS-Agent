import test from "node:test";
import assert from "node:assert/strict";
import { OrchestrationEngine } from "../src/pipeline/engine.js";
import { createMockClient } from "./helpers.js";

test("orchestrates a reflection across all specialist services", async () => {
  const engine = new OrchestrationEngine({
    clients: {
      memory: createMockClient({
        post: {
          "/v1/reflections/ingest": { ok: true, payload: { nodesUpserted: 5, edgesUpserted: 7 } },
        },
      }),
      pattern: createMockClient({
        post: {
          "/v1/patterns/ingest": { ok: true, payload: { detectedCount: 2, summary: { familyCounts: { anxiety: 1 } } } },
        },
      }),
      narrative: createMockClient({
        post: {
          "/v1/narratives/ingest": { ok: true, payload: { detectedCount: 1, summary: { familyCounts: { burnout: 1 } } } },
        },
      }),
      research: createMockClient({
        post: {
          "/v1/retrieve": {
            ok: true,
            payload: {
              results: [
                { source: { title: "CBT and self-criticism" }, confidence: 0.91, citation: { citationText: "A (2021)" } },
              ],
            },
          },
        },
      }),
    },
    config: { topK: 3 },
  });

  const result = await engine.orchestrateReflection({
    userId: "user-1",
    text: "I am burnt out at work and I keep saying yes when I want rest and boundaries.",
    metadata: { researchFrameworks: ["cbt"] },
  });

  assert.equal(result.ok, true);
  assert.equal(result.mode, "reflection");
  assert.equal(result.userId, "user-1");
  assert.ok(result.understanding.themes.includes("work pressure"));
  assert.ok(result.understanding.themes.includes("burnout"));
  assert.equal(result.services.memory.ok, true);
  assert.equal(result.services.pattern.ok, true);
  assert.equal(result.services.narrative.ok, true);
  assert.equal(result.services.research.ok, true);
  assert.equal(result.summary.patternDetections, 2);
  assert.equal(result.summary.narrativeDetections, 1);
});

test("search aggregates service outputs", async () => {
  const engine = new OrchestrationEngine({
    clients: {
      memory: createMockClient({
        post: {
          "/v1/search": { ok: true, payload: { results: [{ id: "memory-1" }] } },
        },
      }),
      pattern: createMockClient({
        get: {
          "/v1/search": { ok: true, payload: { results: [{ id: "pattern-1" }] } },
        },
      }),
      narrative: createMockClient({
        get: {
          "/v1/search": { ok: true, payload: { results: [{ id: "narrative-1" }] } },
        },
      }),
      research: createMockClient({
        get: {
          "/v1/search": { ok: true, payload: { results: [{ documentId: "doc-1" }] } },
        },
      }),
    },
    config: { topK: 3 },
  });

  const result = await engine.search({ userId: "user-1", query: "boundaries and burnout" });
  assert.equal(result.ok, true);
  assert.equal(result.summary.memoryHits, 1);
  assert.equal(result.summary.patternHits, 1);
  assert.equal(result.summary.narrativeHits, 1);
  assert.equal(result.summary.researchHits, 1);
});

