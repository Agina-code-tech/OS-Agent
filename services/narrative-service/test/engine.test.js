import test from "node:test";
import assert from "node:assert/strict";
import { NarrativeIntelligenceEngine } from "../src/pipeline/engine.js";
import { InMemoryNarrativeStore } from "../src/stores/memory-store.js";

function buildInput(occurredAt) {
  return {
    userId: "user-narrative",
    text: "I am exhausted and burnt out. I need rest, space, and better boundaries. I keep overextending and people pleasing, but I am learning to say no and trust my own judgment.",
    sourceType: "journal_entry",
    sourceId: `journal-${occurredAt}`,
    occurredAt,
    metadata: {
      domain: "work",
      lifeDomain: "career",
      supportingMemories: [
        { id: "memory-1", summary: "Worked late all week and skipped rest." },
      ],
      supportingPatterns: [
        { id: "pattern-1", label: "burnout" },
        { id: "pattern-2", label: "people pleasing" },
      ],
      supportingEmotions: [
        { id: "emotion-1", label: "exhaustion" },
      ],
      supportingGoals: [
        { id: "goal-1", label: "rest" },
        { id: "goal-2", label: "say no" },
      ],
    },
  };
}

test("ingests narrative evidence and tracks identity evolution", async () => {
  const store = new InMemoryNarrativeStore();
  const engine = new NarrativeIntelligenceEngine({ store, config: { maxSearchResults: 10, reportLookbackMultiplier: 2 } });
  await engine.ensureReady();

  const dates = [
    "2026-01-10T09:00:00.000Z",
    "2026-03-01T09:00:00.000Z",
    "2026-04-20T09:00:00.000Z",
    "2026-05-12T09:00:00.000Z",
    "2026-06-01T09:00:00.000Z",
  ];

  for (const occurredAt of dates) {
    const result = await engine.ingest(buildInput(occurredAt));
    assert.equal(result.ok, true);
    assert.ok(result.detectedCount >= 2);
  }

  const narratives = await engine.listNarratives("user-narrative");
  assert.ok(narratives.length >= 3);

  const burnout = narratives.find((narrative) => narrative.label === "Recovering From Burnout");
  assert.ok(burnout);
  assert.equal(burnout.frequency, 5);
  assert.ok(["growing", "stable", "completed"].includes(burnout.trendDirection));
  assert.ok(burnout.currentChapterNumber >= 2);

  const search = await engine.search("user-narrative", "burnout");
  assert.equal(search.ok, true);
  assert.ok(search.results.length >= 1);

  const occurrences = await engine.getOccurrences("user-narrative", burnout.id);
  assert.equal(occurrences.length, 5);
  assert.ok(occurrences[0].identitySignals.beliefChanges.length >= 0);

  const evolution = await engine.getEvolution("user-narrative", burnout.id);
  assert.equal(evolution.length, 5);

  const summary = await engine.buildIdentitySummary("user-narrative");
  assert.equal(summary.ok, true);
  assert.match(summary.whoThisPersonIsBecoming, /more/);
  assert.ok(summary.majorThemes.length >= 1);
});
