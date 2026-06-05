import { createHashEmbedding } from "../embeddings/hash-vector.js";
import { scoreMemoryNode } from "./scoring.js";

export class MemoryBackupStore {
  constructor() {
    this.reflections = new Map();
    this.nodes = new Map();
    this.edges = new Map();
    this.events = [];
  }

  async ensureSchema() {
    return true;
  }

  async healthCheck() {
    return { ok: true, provider: "memory" };
  }

  async saveReflection(record) {
    const existing = this.events.reduce((max, event) => {
      return event.userId === record.userId ? Math.max(max, event.graphRevision || 0) : max;
    }, 0);
    const graphRevision = existing + 1;
    this.reflections.set(record.reflectionId, { ...record, graphRevision });
    return { ...record, graphRevision };
  }

  async upsertNodes(userId, reflectionId, nodes, capturedAt) {
    for (const node of nodes) {
      const key = `${userId}:${node.canonicalKey}`;
      this.nodes.set(key, {
        ...node,
        userId,
        reflectionId,
        firstSeenAt: node.firstSeenAt || capturedAt,
        lastSeenAt: capturedAt,
        embedding: node.embedding || createHashEmbedding(`${node.title} ${node.summary} ${node.body}`),
      });
    }

    return nodes;
  }

  async upsertEdges(userId, reflectionId, edges, capturedAt) {
    for (const edge of edges) {
      const key = `${userId}:${edge.canonicalKey}`;
      this.edges.set(key, {
        ...edge,
        userId,
        reflectionId,
        firstSeenAt: edge.firstSeenAt || capturedAt,
        lastSeenAt: capturedAt,
      });
    }

    return edges;
  }

  async appendEvent(event) {
    this.events.push(event);
    return event;
  }

  async getMemoryById(userId, id) {
    for (const node of this.nodes.values()) {
      if (node.userId === userId && node.id === id) return node;
    }
    return null;
  }

  async searchNodes({ userId, query, topK = 10, domains = [] }) {
    const queryEmbedding = createHashEmbedding(query);
    const results = [];

    for (const node of this.nodes.values()) {
      if (node.userId !== userId) continue;
      const haystack = [node.title, node.summary, node.body, node.lifeDomains?.join(" ")].filter(Boolean).join(" ");
      const lexicalHit = haystack.toLowerCase().includes(String(query).toLowerCase()) ? 1 : 0;
      results.push({
        ...node,
        score: scoreMemoryNode(node, { queryEmbedding, domain: domains.join(" ") }),
        lexicalHit,
      });
    }

    results.sort((a, b) => b.score - a.score || b.lexicalHit - a.lexicalHit);
    return results.slice(0, topK);
  }

  async listEvolution(userId, nodeId) {
    return this.events.filter((event) => event.userId === userId && (!nodeId || event.reflectionId === nodeId || event.entityId === nodeId));
  }
}

