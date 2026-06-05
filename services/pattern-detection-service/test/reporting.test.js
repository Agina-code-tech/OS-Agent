import test from "node:test";
import assert from "node:assert/strict";
import { buildReport } from "../src/reporting/reports.js";
import { PatternDetectionEngine } from "../src/pipeline/engine.js";
import { InMemoryPatternStore } from "../src/stores/memory-store.js";

test("builds weekly, monthly, and quarterly reports from stored patterns", async () => {
  const store = new InMemoryPatternStore();
  const engine = new PatternDetectionEngine({ store, config: { maxSearchResults: 10, reportLookbackMultiplier: 2 } });

  const dates = [
    "2026-04-20T09:00:00.000Z",
    "2026-05-10T09:00:00.000Z",
    "2026-05-20T09:00:00.000Z",
    "2026-06-01T09:00:00.000Z",
  ];

  for (const occurredAt of dates) {
    await engine.ingest({
      userId: "report-user",
      text: "I am anxious and worried about the deadline. I keep avoiding the task and overthinking every detail. I feel ashamed and I need approval.",
      sourceType: "reflection",
      sourceId: `reflection-${occurredAt}`,
      occurredAt,
      metadata: { domain: "work" },
    });
  }

  const patterns = await store.listPatterns("report-user");
  const occurrences = await store.getOccurrencesByRange(
    "report-user",
    "2026-04-01T00:00:00.000Z",
    "2026-06-05T00:00:00.000Z",
  );

  const report = buildReport({
    userId: "report-user",
    period: "monthly",
    patterns,
    occurrences,
    now: new Date("2026-06-04T00:00:00.000Z"),
  });

  assert.equal(report.ok, true);
  assert.equal(report.period, "monthly");
  assert.ok(report.summary.totalPatterns >= 3);
  assert.ok(report.summary.totalOccurrences >= 1);
  assert.ok(report.activePatterns.length >= 1);
  assert.ok(report.reinforcementLoops.length >= 1);
  assert.ok(report.strengthening.length >= 1);
});
