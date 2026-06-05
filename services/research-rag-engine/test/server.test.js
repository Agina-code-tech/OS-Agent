import test from "node:test";
import assert from "node:assert/strict";
import { ResearchRagEngine } from "../src/pipeline/engine.js";
import { InMemoryResearchStore } from "../src/stores/memory-store.js";
import { createResearchServer } from "../src/http/server.js";
import { TestEmbeddingProvider, buildSampleDocuments } from "./helpers.js";

test("serves health, ingest, retrieve, and listing endpoints", async () => {
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

  const service = createResearchServer({ engine, stores: { research: store }, port: 0 });
  await service.listen();

  const address = service.server.address();
  assert.ok(address && typeof address === "object");
  const { port } = address;

  try {
    const health = await fetch(`http://127.0.0.1:${port}/healthz`);
    assert.equal(health.status, 200);
    const healthJson = await health.json();
    assert.equal(healthJson.ok, true);

    const ingest = await fetch(`http://127.0.0.1:${port}/v1/documents/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildSampleDocuments()[0]),
    });
    assert.equal(ingest.status, 200);
    const ingestJson = await ingest.json();
    assert.equal(ingestJson.ok, true);
    assert.ok(ingestJson.chunkCount >= 1);

    const documents = await fetch(`http://127.0.0.1:${port}/v1/documents`);
    assert.equal(documents.status, 200);
    const documentsJson = await documents.json();
    assert.equal(documentsJson.ok, true);
    assert.ok(documentsJson.total >= 1);

    const retrieve = await fetch(`http://127.0.0.1:${port}/v1/retrieve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "cognitive distortions and self-criticism" }),
    });
    assert.equal(retrieve.status, 200);
    const retrieveJson = await retrieve.json();
    assert.equal(retrieveJson.ok, true);
    assert.ok(retrieveJson.results.length >= 1);
    assert.ok(retrieveJson.citations.length >= 1);

    const retrievals = await fetch(`http://127.0.0.1:${port}/v1/retrievals`);
    assert.equal(retrievals.status, 200);
    const retrievalsJson = await retrievals.json();
    assert.equal(retrievalsJson.ok, true);
    assert.ok(retrievalsJson.total >= 1);
  } finally {
    await service.close();
  }
});
