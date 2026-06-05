import test from "node:test";
import assert from "node:assert/strict";
import { NarrativeIntelligenceEngine } from "../src/pipeline/engine.js";
import { InMemoryNarrativeStore } from "../src/stores/memory-store.js";
import { createNarrativeServer } from "../src/http/server.js";

test("serves health, ingest, narrative, and identity endpoints", async () => {
  const store = new InMemoryNarrativeStore();
  const engine = new NarrativeIntelligenceEngine({ store, config: { maxSearchResults: 10, reportLookbackMultiplier: 2 } });
  const service = createNarrativeServer({ engine, stores: { narrative: store }, port: 0 });

  await service.listen();
  const address = service.server.address();
  assert.ok(address && typeof address === "object");
  const { port } = address;

  try {
    const health = await fetch(`http://127.0.0.1:${port}/healthz`);
    assert.equal(health.status, 200);
    const healthJson = await health.json();
    assert.equal(healthJson.ok, true);

    const ingest = await fetch(`http://127.0.0.1:${port}/v1/narratives/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: "server-user",
        text: "I am exhausted and burnt out. I need rest, space, and better boundaries. I keep overextending and people pleasing, but I am learning to say no and trust my own judgment.",
        sourceType: "check_in",
        occurredAt: "2026-06-01T09:00:00.000Z",
        metadata: {
          supportingPatterns: [{ label: "burnout" }, { label: "people pleasing" }],
          supportingGoals: [{ label: "rest" }, { label: "say no" }],
        },
      }),
    });
    assert.equal(ingest.status, 200);
    const ingestJson = await ingest.json();
    assert.equal(ingestJson.ok, true);
    assert.ok(ingestJson.detectedCount >= 2);

    const narratives = await fetch(`http://127.0.0.1:${port}/v1/narratives?userId=server-user`);
    assert.equal(narratives.status, 200);
    const narrativesJson = await narratives.json();
    assert.equal(narrativesJson.ok, true);
    assert.ok(narrativesJson.total >= 1);

    const report = await fetch(`http://127.0.0.1:${port}/v1/reports/annual?userId=server-user`);
    assert.equal(report.status, 200);
    const reportJson = await report.json();
    assert.equal(reportJson.ok, true);
    assert.ok(Array.isArray(reportJson.activeNarratives));

    const identity = await fetch(`http://127.0.0.1:${port}/v1/identity/summary?userId=server-user`);
    assert.equal(identity.status, 200);
    const identityJson = await identity.json();
    assert.equal(identityJson.ok, true);
    assert.match(identityJson.whoThisPersonIsBecoming, /more/);
  } finally {
    await service.close();
  }
});
