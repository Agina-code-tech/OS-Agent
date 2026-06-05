import test from "node:test";
import assert from "node:assert/strict";
import { PatternDetectionEngine } from "../src/pipeline/engine.js";
import { InMemoryPatternStore } from "../src/stores/memory-store.js";
import { createPatternServer } from "../src/http/server.js";

test("serves health, ingest, and report endpoints", async () => {
  const store = new InMemoryPatternStore();
  const engine = new PatternDetectionEngine({ store, config: { maxSearchResults: 10, reportLookbackMultiplier: 2 } });
  const service = createPatternServer({ engine, stores: { pattern: store }, port: 0 });

  await service.listen();
  const address = service.server.address();
  assert.ok(address && typeof address === "object");
  const { port } = address;

  try {
    const health = await fetch(`http://127.0.0.1:${port}/healthz`);
    assert.equal(health.status, 200);
    const healthJson = await health.json();
    assert.equal(healthJson.ok, true);

    const ingest = await fetch(`http://127.0.0.1:${port}/v1/patterns/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: "server-user",
        text: "I am anxious and worried about the deadline. I keep avoiding the task and overthinking every detail. I feel ashamed and I need approval.",
        sourceType: "check_in",
        occurredAt: "2026-06-01T09:00:00.000Z",
      }),
    });
    assert.equal(ingest.status, 200);
    const ingestJson = await ingest.json();
    assert.equal(ingestJson.ok, true);
    assert.ok(ingestJson.detectedCount >= 1);

    const patterns = await fetch(`http://127.0.0.1:${port}/v1/patterns?userId=server-user`);
    assert.equal(patterns.status, 200);
    const patternsJson = await patterns.json();
    assert.equal(patternsJson.ok, true);
    assert.ok(patternsJson.total >= 1);

    const report = await fetch(`http://127.0.0.1:${port}/v1/reports/weekly?userId=server-user`);
    assert.equal(report.status, 200);
    const reportJson = await report.json();
    assert.equal(reportJson.ok, true);
    assert.ok(Array.isArray(reportJson.activePatterns));
  } finally {
    await service.close();
  }
});
