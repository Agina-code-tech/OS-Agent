import { DEFAULT_CONTEXT_BUDGET, DEFAULT_TOP_K, DEFAULT_CHUNK_OVERLAP, DEFAULT_CHUNK_WORDS } from "../domain/constants.js";
import { normalizeText, stableHash, uniqueBy, average, cosineSimilarity, truncate } from "../domain/text.js";
import { chunkDocument } from "../ingestion/chunking.js";
import { EmbeddingProvider, extractQueryFrameworks } from "../embeddings/provider.js";
import { buildSupportingEvidence, compressChunkText } from "../retrieval/compression.js";
import { confidenceFromScores, rerankCandidates } from "../retrieval/rerank.js";
import { evaluateRetrievalBenchmark } from "../reporting/evaluation.js";
import { buildDocumentId, buildRetrievalId, buildCitationText, mergeUniqueStrings, summarizeConfidence } from "../stores/store-utils.js";
import { isDisallowedQuery, buildSafetyRefusal } from "../policy/safety.js";
import { bm25Score, buildCorpusStats, lexicalOverlapScore } from "../retrieval/bm25.js";

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function toArray(value) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function normalizePublicationType(value = "") {
  return String(value || "peer_reviewed_research_paper").trim().toLowerCase();
}

function buildSourceObject(document) {
  return {
    id: document.id,
    title: document.title,
    authors: document.authors || [],
    publisher: document.publisher || null,
    journal: document.journal || null,
    sourceUrl: document.sourceUrl || null,
    doi: document.doi || null,
    citationKey: document.citationKey,
    citationText: document.citationText,
  };
}

function buildResultForDocument(document, supportingChunks, query) {
  const evidence = supportingChunks.slice(0, 3).map((chunk) => buildSupportingEvidence(chunk, query));
  const scores = {
    bm25Score: average(supportingChunks.map((chunk) => chunk.bm25Score || 0)),
    lexicalScore: average(supportingChunks.map((chunk) => chunk.lexicalScore || 0)),
    vectorScore: average(supportingChunks.map((chunk) => chunk.vectorScore || 0)),
    rerankScore: average(supportingChunks.map((chunk) => chunk.rerankScore || 0)),
  };

  const source = buildSourceObject(document);
  const confidence = confidenceFromScores(scores);
  return {
    documentId: document.id,
    source,
    confidence,
    publicationType: document.publicationType,
    publicationYear: document.publicationYear || null,
    supportingEvidence: evidence,
    citation: {
      citationKey: document.citationKey,
      citationText: document.citationText,
      sourceUrl: document.sourceUrl || null,
      doi: document.doi || null,
    },
    frameworks: mergeUniqueStrings(document.frameworks || [], supportingChunks.flatMap((chunk) => chunk.frameworks || [])),
    topics: mergeUniqueStrings(document.tags || [], document.domains || []),
    summary: document.summary || truncate(document.abstract || document.title || "", 260),
    scores,
    bestChunk: supportingChunks[0]
      ? {
      id: supportingChunks[0].id,
      chunkIndex: supportingChunks[0].chunkIndex,
      heading: supportingChunks[0].heading,
      embedding: supportingChunks[0].embedding || null,
      excerpt: compressChunkText(supportingChunks[0].text, query, 2),
    }
      : null,
  };
}

function groupChunksByDocument(chunks = []) {
  return chunks.reduce((acc, chunk) => {
    const key = chunk.documentId;
    if (!acc.has(key)) {
      acc.set(key, []);
    }
    acc.get(key).push(chunk);
    return acc;
  }, new Map());
}

function aggregateChunkScores(chunks = []) {
  const best = chunks[0] || {};
  return {
    bm25Score: best.bm25Score || 0,
    lexicalScore: best.lexicalScore || 0,
    vectorScore: best.vectorScore || 0,
    rerankScore: best.rerankScore || 0,
  };
}

function buildCompressedContext(results = [], query, budgetChars = DEFAULT_CONTEXT_BUDGET) {
  const parts = [];
  let total = 0;
  for (const result of results) {
    for (const evidence of result.supportingEvidence || []) {
      const line = `[${result.source.citationKey}] ${evidence.excerpt}`;
      if (total + line.length > budgetChars) break;
      parts.push(line);
      total += line.length;
    }
    if (total >= budgetChars) break;
  }
  return parts.join("\n\n");
}

function buildQueryContext(query, options = {}) {
  const frameworks = uniqueBy([
    ...extractQueryFrameworks(query),
    ...(options.frameworks || []),
  ], (value) => value);
  return {
    frameworks,
    publicationType: options.publicationType ? normalizePublicationType(options.publicationType) : null,
    collection: options.collection || null,
    tags: toArray(options.tags),
  };
}

export class ResearchRagEngine {
  constructor({ store, config = {}, embeddingProvider = null } = {}) {
    if (!store) {
      throw new Error("ResearchRagEngine requires a store");
    }

    this.store = store;
    this.config = {
      port: Number(config.port || 8092),
      topK: Number(config.topK || DEFAULT_TOP_K),
      contextBudget: Number(config.contextBudget || DEFAULT_CONTEXT_BUDGET),
      chunkWords: Number(config.chunkWords || DEFAULT_CHUNK_WORDS),
      chunkOverlap: Number(config.chunkOverlap || DEFAULT_CHUNK_OVERLAP),
      evaluationName: config.evaluationName || "research-rag-benchmark",
      openAiApiKey: config.openAiApiKey || "",
      embeddingModel: config.embeddingModel || "text-embedding-3-small",
      vectorDimension: Number(config.vectorDimension || 1536),
    };
    this.embeddingProvider = embeddingProvider || new EmbeddingProvider({
      openAiApiKey: this.config.openAiApiKey,
      embeddingModel: this.config.embeddingModel,
      vectorDimension: this.config.vectorDimension,
    });
  }

  async ensureReady() {
    await this.store.ensureSchema?.();
  }

  async ingest(input) {
    if (Array.isArray(input?.documents)) {
      const results = [];
      for (const document of input.documents) {
        results.push(await this.ingestOne(document));
      }
      return {
        ok: true,
        mode: "batch",
        processedCount: results.length,
        results,
      };
    }
    return this.ingestOne(input);
  }

  async ingestOne(input) {
    const content = normalizeText(input.content || input.text || input.body || input.abstract || "");
    const title = String(input.title || input.name || "Untitled source").trim();
    if (!content && !String(input.abstract || "").trim()) {
      throw new Error("content or abstract is required");
    }

    const document = {
      id: input.id || buildDocumentId(input),
      collection: input.collection || "default",
      title,
      abstract: normalizeText(input.abstract || ""),
      content,
      summary: normalizeText(input.summary || input.abstract || content.slice(0, 500)),
      publicationType: normalizePublicationType(input.publicationType || input.sourceType),
      publicationYear: Number.isFinite(Number(input.publicationYear)) ? Number(input.publicationYear) : null,
      authors: mergeUniqueStrings([], ...toArray(input.authors).map((author) => String(author))),
      publisher: input.publisher || null,
      journal: input.journal || null,
      doi: input.doi || null,
      sourceUrl: input.sourceUrl || input.url || null,
      tags: mergeUniqueStrings(input.tags || [], input.domains || []),
      frameworks: mergeUniqueStrings(input.frameworks || [], input.labels || []),
      domains: mergeUniqueStrings(input.domains || [], input.topics || []),
      citationKey: input.citationKey || null,
      citationText: input.citationText || null,
    };
    document.citationKey = document.citationKey || stableHash([document.doi || document.sourceUrl || document.title, document.publicationYear || "", document.publicationType].join("|")).slice(0, 24);
    document.citationText = document.citationText || buildCitationText(document);

    const chunks = chunkDocument(content || document.abstract || "", {
      maxWords: this.config.chunkWords,
      overlapWords: this.config.chunkOverlap,
    });
    const sourceText = `${document.title}\n${document.abstract}\n${document.content}`;
    const embeddings = await this.embeddingProvider.embedMany(
      chunks.map((chunk) => `${document.title}\n${document.abstract}\n${chunk.heading || ""}\n${chunk.text}`.trim() || sourceText),
    );

    const stored = await this.store.ingestDocument({
      ...document,
      chunks,
      embeddings,
    });

    return {
      ok: true,
      document: stored.document,
      chunks: stored.chunks,
      chunkCount: stored.chunks.length,
    };
  }

  async listDocuments(filters = {}) {
    return this.store.listDocuments(filters);
  }

  async getDocument(documentId) {
    return this.store.getDocument(documentId);
  }

  async getChunk(chunkId) {
    return this.store.getChunk(chunkId);
  }

  async retrieve(queryInput, options = {}) {
    const query = typeof queryInput === "string" ? queryInput : String(queryInput?.query || queryInput?.text || "");
    if (isDisallowedQuery(query)) {
      return buildSafetyRefusal(query);
    }

    const context = buildQueryContext(query, queryInput && typeof queryInput === "object" ? queryInput : options);
    const queryEmbedding = await this.embeddingProvider.embedText(query);
    const candidateChunks = await this.store.searchCandidates(query, context);
    const withVectorScores = candidateChunks.map((chunk) => ({
      ...chunk,
      vectorScore: chunk.embedding ? cosineSimilarity(queryEmbedding, chunk.embedding) : 0,
      bm25Score: chunk.bm25Score || 0,
      lexicalScore: chunk.lexicalScore || lexicalOverlapScore(query, chunk.text),
    }));
    const rerankedChunks = rerankCandidates(withVectorScores, query, queryEmbedding, context);
    const topChunks = rerankedChunks.slice(0, Math.max(1, Number(queryInput?.topK || options.topK || this.config.topK)));
    const documents = await Promise.all(topChunks.map((chunk) => this.store.getDocument(chunk.documentId)));
    const documentMap = new Map();

    for (const chunk of topChunks) {
      if (!documentMap.has(chunk.documentId)) {
        documentMap.set(chunk.documentId, []);
      }
      documentMap.get(chunk.documentId).push(chunk);
    }

    const results = [];
    for (const [documentId, chunks] of documentMap.entries()) {
      const document = documents.find((item) => item && item.id === documentId) || await this.store.getDocument(documentId);
      if (!document) continue;
      const rankedChunks = chunks.sort((a, b) => b.rerankScore - a.rerankScore || b.vectorScore - a.vectorScore);
      results.push(buildResultForDocument(document, rankedChunks, query));
    }

    const rankedResults = rerankCandidates(results.map((result) => ({
      ...result,
      embedding: result.bestChunk?.embedding || [],
      bm25Score: result.scores.bm25Score,
      lexicalScore: result.scores.lexicalScore,
      vectorScore: result.scores.vectorScore,
      frameworks: result.frameworks,
      publicationType: result.publicationType,
      publicationYear: result.publicationYear,
      text: result.supportingEvidence.map((item) => item.excerpt).join(" "),
      authors: result.source.authors,
    })), query, queryEmbedding, context)
      .map((item) => ({
        ...item,
        confidence: confidenceFromScores(item),
      }))
      .slice(0, this.config.topK);

    const compressedContext = buildCompressedContext(rankedResults, query, this.config.contextBudget);
    const retrieval = {
      id: buildRetrievalId(query),
      userId: "global",
      query,
      queryHash: stableHash(`${query}:${JSON.stringify(context)}`),
      queryEmbedding,
      context,
      results: rankedResults.map((result) => ({
        ...result,
        confidence: summarizeConfidence([result.confidence, result.scores?.rerankScore, result.scores?.vectorScore, result.scores?.bm25Score]),
      })),
      compressedContext,
      sourceCount: rankedResults.length,
      createdAt: new Date().toISOString(),
    };

    await this.store.saveRetrieval(retrieval);

    return {
      ok: true,
      query,
      frameworks: context.frameworks,
      sourceCount: rankedResults.length,
      compressedContext,
      results: retrieval.results,
      citations: retrieval.results.map((result) => result.citation),
    };
  }

  async search(query, options = {}) {
    return this.retrieve(query, options);
  }

  async evaluate(benchmark = {}) {
    const evaluation = await evaluateRetrievalBenchmark(benchmark, (query, options) => this.retrieve(query, options));
    const record = {
      id: `eval_${stableHash(`${benchmark.name || "benchmark"}:${JSON.stringify(evaluation.metrics)}`).slice(0, 20)}`,
      name: benchmark.name || this.config.evaluationName,
      metrics: evaluation.metrics,
      details: evaluation.details,
      createdAt: new Date().toISOString(),
    };
    await this.store.saveEvaluation(record);
    return {
      ...evaluation,
      evaluation: record,
    };
  }

  async health() {
    return this.store.healthCheck?.() || { ok: true };
  }
}
