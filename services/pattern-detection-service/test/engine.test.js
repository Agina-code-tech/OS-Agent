import test from "node:test";
import assert from "node:assert/strict";
import { PatternDetectionEngine } from "../src/pipeline/engine.js";
import { InMemoryPatternStore } from "../src/stores/memory-store.js";

function buildInput(occurredAt) {
  return {
    userId: "user-patterns",
    text: "I am anxious and worried about the deadline. I keep avoiding the task and overthinking every detail. I feel ashamed and I need approval.",
    sourceType: "journal_entry",
    sourceId: `entry-${occurredAt}`,
    occurredAt,
    metadata: {
      domain: "work",
      lifeDomain: "career",
    },
  };
}

test("ingests recurring signals and tracks strengthening trend", async () => {
  const store = new InMemoryPatternStore();
  const engine = new PatternDetectionEngine({ store, config: { maxSearchResults: 10, reportLookbackMultiplier: 2 } });

  await engine.ensureReady();

  const dates = [
    "2026-04-20T09:00:00.000Z",
    "2026-05-10T09:00:00.000Z",
    "2026-05-20T09:00:00.000Z",
    "2026-06-01T09:00:00.000Z",
  ];

  for (const occurredAt of dates) {
    const result = await engine.ingest(buildInput(occurredAt));
    assert.equal(result.ok, true);
    assert.ok(result.detectedCount >= 1);
  }

  const patterns = await engine.listPatterns("user-patterns");
  assert.ok(patterns.length >= 3);

  const anxiety = patterns.find((pattern) => pattern.label.includes("anxiety"));
  assert.ok(anxiety);
  assert.equal(anxiety.frequency, 4);
  assert.equal(anxiety.trendDirection, "strengthening");

  const search = await engine.search("user-patterns", "anxiety");
  assert.equal(search.ok, true);
  assert.ok(search.results.length >= 1);

  const occurrences = await engine.getOccurrences("user-patterns", anxiety.id);
  assert.equal(occurrences.length, 4);

  const evolution = await engine.getEvolution("user-patterns", anxiety.id);
  assert.equal(evolution.length, 4);

  const report = await engine.buildReport("user-patterns", "monthly");
  assert.equal(report.ok, true);
  assert.ok(report.activePatterns.length >= 1);
  assert.ok(report.strengthening.some((pattern) => pattern.label.includes("anxiety")));
});
