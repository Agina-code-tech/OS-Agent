import test from "node:test";
import assert from "node:assert/strict";
import { buildReport } from "../src/reporting/reports.js";
import { NarrativeIntelligenceEngine } from "../src/pipeline/engine.js";
import { InMemoryNarrativeStore } from "../src/stores/memory-store.js";

test("builds monthly, quarterly, and annual narrative reports", async () => {
  const store = new InMemoryNarrativeStore();
  const engine = new NarrativeIntelligenceEngine({ store, config: { maxSearchResults: 10, reportLookbackMultiplier: 2 } });

  const dates = [
    "2026-01-10T09:00:00.000Z",
    "2026-03-01T09:00:00.000Z",
    "2026-04-20T09:00:00.000Z",
    "2026-05-12T09:00:00.000Z",
    "2026-06-01T09:00:00.000Z",
  ];

  for (const occurredAt of dates) {
    await engine.ingest({
      userId: "report-user",
      text: "I am exhausted and burnt out. I need rest, space, and better boundaries. I keep overextending and people pleasing, but I am learning to say no and trust my own judgment.",
      sourceType: "reflection",
      sourceId: `reflection-${occurredAt}`,
      occurredAt,
      metadata: {
        supportingPatterns: [{ label: "burnout" }, { label: "people pleasing" }],
        supportingGoals: [{ label: "rest" }, { label: "say no" }],
      },
    });
  }

  const narratives = await store.listNarratives("report-user");
  const occurrences = await store.getOccurrencesByRange(
    "report-user",
    "2026-01-01T00:00:00.000Z",
    "2026-06-05T00:00:00.000Z",
  );

  const report = buildReport({
    userId: "report-user",
    period: "quarterly",
    narratives,
    occurrences,
    now: new Date("2026-06-04T00:00:00.000Z"),
  });

  assert.equal(report.ok, true);
  assert.equal(report.period, "quarterly");
  assert.ok(report.summary.totalNarratives >= 3);
  assert.ok(report.activeNarratives.length >= 1);
  assert.ok(report.majorThemes.length >= 1);
  assert.ok(report.identityEvolution.becomingSummary.length > 0);
  assert.ok(report.growing.length >= 1);
});
