import test from "node:test";
import assert from "node:assert/strict";
import { ResearchRagEngine } from "../src/pipeline/engine.js";
import { InMemoryResearchStore } from "../src/stores/memory-store.js";
import { TestEmbeddingProvider, buildSampleDocuments } from "./helpers.js";

async function buildEngine() {
  const store = new InMemoryResearchStore();
  const engine = new ResearchRagEngine({
    store,
    config: {
      topK: 5,
      contextBudget: 900,
      chunkWords: 40,
      chunkOverlap: 8,
    },
    embeddingProvider: new TestEmbeddingProvider(),
  });

  await engine.ensureReady();
  for (const document of buildSampleDocuments()) {
    await engine.ingest(document);
  }

  return { engine, store };
}

test("evaluates retrieval benchmarks and stores the report", async () => {
  const { engine, store } = await buildEngine();
  const evaluation = await engine.evaluate({
    name: "psychology-rag-smoke-test",
    queries: [
      {
        query: "cognitive distortions and self-criticism",
        expectedDocumentIds: ["doc-cbt"],
      },
      {
        query: "secure base attachment style",
        expectedDocumentIds: ["doc-attachment"],
      },
    ],
  });

  assert.equal(evaluation.ok, true);
  assert.ok(evaluation.metrics.precisionAt5 > 0);
  assert.ok(evaluation.metrics.recallAt5 > 0);
  assert.equal(evaluation.metrics.citationCoverage, 1);

  const stored = await store.listEvaluations();
  assert.equal(stored.length, 1);
  assert.equal(stored[0].name, "psychology-rag-smoke-test");
  assert.ok(stored[0].metrics.precisionAt5 >= evaluation.metrics.precisionAt5 - 0.0001);
});
