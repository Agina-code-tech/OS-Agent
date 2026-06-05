import assert from "node:assert/strict";
import test from "node:test";
import { MemoryGraphEngine } from "../src/pipeline/engine.js";
import { InMemoryGraphStore } from "../src/graph/in-memory-store.js";
import { MemoryBackupStore } from "../src/graph/memory-backup-store.js";

test("ingests a reflection into memory graph nodes and edges", async () => {
  const engine = new MemoryGraphEngine({
    graphStore: new InMemoryGraphStore(),
    backupStore: new MemoryBackupStore(),
    config: { memorySearchTopK: 10 },
  });

  const result = await engine.ingestReflection({
    userId: "user-1",
    text: "I felt anxious at work because I believe my manager does not trust me. I want to speak up and finish the project.",
    source: "reflection",
    occurredAt: "2026-06-04T10:00:00.000Z",
    metadata: {},
  });

  assert.equal(result.ok, true);
  assert.ok(result.nodesUpserted >= 3);
  assert.ok(result.edgesUpserted >= 2);
  assert.ok(Array.isArray(result.preview));
});

test("search returns ranked results", async () => {
  const graphStore = new InMemoryGraphStore();
  const backupStore = new MemoryBackupStore();
  const engine = new MemoryGraphEngine({
    graphStore,
    backupStore,
    config: { memorySearchTopK: 10 },
  });

  await engine.ingestReflection({
    userId: "user-1",
    text: "I want to improve my work routine and I value honesty and stability.",
    source: "reflection",
    occurredAt: "2026-06-04T10:00:00.000Z",
    metadata: {},
  });

  const search = await engine.search({
    userId: "user-1",
    query: "work routine stability",
    topK: 5,
  });

  assert.ok(search.results.length > 0);
});

