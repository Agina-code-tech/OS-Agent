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
    const result = await engine.ingest(document);
    assert.equal(result.ok, true);
  }

  return { engine, store };
}

test("retrieves evidence-based psychology sources with citations and confidence", async () => {
  const { engine } = await buildEngine();
  const response = await engine.retrieve("cognitive distortions and self-criticism");

  assert.equal(response.ok, true);
  assert.ok(response.results.length >= 1);

  const first = response.results[0];
  assert.equal(first.source.title, "Cognitive Distortions and Self-Criticism in CBT");
  assert.equal(first.publicationType, "peer_reviewed_research_paper");
  assert.equal(first.publicationYear, 2021);
  assert.ok(first.confidence > 0);
  assert.ok(Array.isArray(first.supportingEvidence));
  assert.ok(first.supportingEvidence[0].excerpt.length > 0);
  assert.ok(first.citation.citationText.includes("Cognitive Distortions and Self-Criticism in CBT"));
  assert.equal(response.citations.length, response.results.length);
  assert.match(response.compressedContext, /self-criticism|cognitive distortions/i);
});

test("supports framework-aware retrieval and returns educational context", async () => {
  const { engine } = await buildEngine();
  const response = await engine.retrieve({
    query: "secure base and attachment style",
    frameworks: ["attachment_theory"],
    topK: 3,
  });

  assert.equal(response.ok, true);
  assert.equal(response.frameworks.includes("attachment_theory"), true);
  assert.equal(response.results[0].source.title, "Attachment Security and Relational Regulation");
  assert.ok(response.results[0].supportingEvidence.some((item) => /secure base|attachment/i.test(item.excerpt)));
});

test("refuses diagnosis and therapy requests", async () => {
  const { engine } = await buildEngine();
  const refusal = await engine.retrieve("Can you diagnose my ADHD or tell me what therapy I need?");

  assert.equal(refusal.ok, false);
  assert.match(refusal.error, /not diagnosis or therapy/i);
  assert.ok(Array.isArray(refusal.safeAlternatives));
  assert.ok(refusal.safeAlternatives.length >= 1);
});
