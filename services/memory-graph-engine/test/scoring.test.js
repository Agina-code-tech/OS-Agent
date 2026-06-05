import assert from "node:assert/strict";
import test from "node:test";
import { scoreEdgeStrength, scoreMemoryNode } from "../src/graph/scoring.js";

test("scores memory nodes higher when they are more recent and salient", () => {
  const older = scoreMemoryNode({
    lastSeenAt: "2024-01-01T00:00:00.000Z",
    salience: 0.2,
    version: 5,
    lifeDomains: ["work"],
  }, { queryEmbedding: [1, 0, 0], domain: "work" });

  const newer = scoreMemoryNode({
    lastSeenAt: new Date().toISOString(),
    salience: 0.9,
    version: 1,
    lifeDomains: ["work"],
    embedding: [1, 0, 0],
  }, { queryEmbedding: [1, 0, 0], domain: "work" });

  assert.ok(newer > older);
});

test("edge strength remains bounded", () => {
  const score = scoreEdgeStrength({ confidence: 0.9, intensity: 0.9, repetition: 3, distance: 0.2 });
  assert.ok(score >= 0 && score <= 1);
});

