import { average, stableHash } from "../domain/text.js";
import { buildCitationKey, buildCitationText, buildChunkId, buildDocumentId } from "./store-utils.js";
import { buildCorpusStats, bm25Score, lexicalOverlapScore } from "../retrieval/bm25.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export class InMemoryResearchStore {
  constructor() {
    this.documents = new Map();
    this.chunks = [];
    this.retrievals = [];
    this.evaluations = [];
  }

  async ensureSchema() {
    return true;
  }

  async healthCheck() {
    return { ok: true, provider: "in-memory" };
  }

  async upsertDocument(document) {
    const id = document.id || buildDocumentId(document);
    const citationKey = document.citationKey || buildCitationKey(document);
    const citationText = document.citationText || buildCitationText(document);
    const record = {
      ...document,
      id,
      citationKey,
      citationText,
      updatedAt: document.updatedAt || new Date().toISOString(),
    };
    this.documents.set(id, record);
    return record;
  }

  async upsertChunks(documentId, chunks, embeddings = []) {
    const inserted = [];
    for (let index = 0; index < chunks.length; index += 1) {
      const chunk = chunks[index];
      const record = {
        id: chunk.id || buildChunkId(documentId, chunk.chunkIndex ?? index, chunk.text),
        documentId,
        chunkIndex: chunk.chunkIndex ?? index,
        heading: chunk.heading || null,
        text: chunk.text,
        tokenCount: chunk.tokenCount || 0,
        startChar: chunk.startChar || 0,
        endChar: chunk.endChar || chunk.text.length,
        pageNumber: chunk.pageNumber || null,
        embedding: embeddings[index] || chunk.embedding || null,
        createdAt: chunk.createdAt || new Date().toISOString(),
      };
      this.chunks.push(record);
      inserted.push(record);
    }
    return inserted;
  }

  async ingestDocument(document) {
    const storedDocument = await this.upsertDocument(document);
    const chunks = await this.upsertChunks(storedDocument.id, document.chunks || [], document.embeddings || []);
    return { document: storedDocument, chunks };
  }

  async listDocuments(filters = {}) {
    return [...this.documents.values()].filter((document) => {
      if (filters.publicationType && document.publicationType !== filters.publicationType) return false;
      if (filters.collection && document.collection !== filters.collection) return false;
      if (filters.framework && !(document.frameworks || []).includes(filters.framework)) return false;
      if (Array.isArray(filters.frameworks) && filters.frameworks.length && !(document.frameworks || []).some((framework) => filters.frameworks.includes(framework))) return false;
      return true;
    });
  }

  async getDocument(documentId) {
    return this.documents.get(documentId) || null;
  }

  async getChunk(chunkId) {
    return this.chunks.find((chunk) => chunk.id === chunkId) || null;
  }

  async listChunks(filters = {}) {
    return this.chunks.filter((chunk) => {
      if (filters.documentId && chunk.documentId !== filters.documentId) return false;
      if (filters.documentIds && !filters.documentIds.includes(chunk.documentId)) return false;
      return true;
    });
  }

  async searchCandidates(query, options = {}) {
    let documentIds = options.documentIds || null;
    if (!documentIds && (options.publicationType || options.collection || options.framework || (Array.isArray(options.frameworks) && options.frameworks.length))) {
      const documents = await this.listDocuments({
        publicationType: options.publicationType,
        collection: options.collection,
        framework: options.framework,
        frameworks: options.frameworks,
      });
      documentIds = documents.map((document) => document.id);
    }

    const chunks = await this.listChunks({
      documentId: options.documentId,
      documentIds,
    });
    const stats = buildCorpusStats(chunks);
    return chunks.map((chunk) => {
      const bm25 = bm25Score(query, chunk.text, stats);
      const lexical = lexicalOverlapScore(query, chunk.text);
      return {
        ...chunk,
        bm25Score: bm25,
        lexicalScore: lexical,
      };
    }).sort((a, b) => b.bm25Score - a.bm25Score || b.lexicalScore - a.lexicalScore);
  }

  async saveRetrieval(retrieval) {
    this.retrievals.push(clone(retrieval));
    return retrieval;
  }

  async listRetrievals(userId = "global") {
    return this.retrievals.filter((retrieval) => retrieval.userId === userId);
  }

  async saveEvaluation(evaluation) {
    this.evaluations.push(clone(evaluation));
    return evaluation;
  }

  async listEvaluations() {
    return this.evaluations;
  }

  async close() {
    return true;
  }
}
