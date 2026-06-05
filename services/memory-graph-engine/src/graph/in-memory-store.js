import { uniqueBy } from "../domain/text.js";

export class InMemoryGraphStore {
  constructor() {
    this.nodes = new Map();
    this.edges = new Map();
    this.events = [];
  }

  async ensureSchema() {
    return true;
  }

  async healthCheck() {
    return { ok: true, provider: "in-memory" };
  }

  async upsertGraph({ userId, reflectionId, revision, nodes = [], edges = [], capturedAt }) {
    let nodeCount = 0;
    let edgeCount = 0;

    for (const node of nodes) {
      const key = `${userId}:${node.canonicalKey}`;
      const existing = this.nodes.get(key);
      const nextVersion = (existing?.version || 0) + 1;
      const merged = {
        ...existing,
        ...node,
        id: existing?.id || node.id,
        version: nextVersion,
        userId,
        reflectionId,
        firstSeenAt: existing?.firstSeenAt || capturedAt,
        lastSeenAt: capturedAt,
      };
      this.nodes.set(key, merged);
      nodeCount += 1;
    }

    for (const edge of edges) {
      const key = `${userId}:${edge.canonicalKey}`;
      const existing = this.edges.get(key);
      const nextVersion = (existing?.version || 0) + 1;
      const merged = {
        ...existing,
        ...edge,
        id: existing?.id || edge.id,
        version: nextVersion,
        userId,
        reflectionId,
        firstSeenAt: existing?.firstSeenAt || capturedAt,
        lastSeenAt: capturedAt,
      };
      this.edges.set(key, merged);
      edgeCount += 1;
    }

    this.events.push({
      id: `${userId}:${reflectionId}:${revision}`,
      userId,
      reflectionId,
      revision,
      createdAt: capturedAt,
      nodeCount,
      edgeCount,
    });

    return { nodeCount, edgeCount, revision };
  }

  async getNode(userId, nodeId) {
    return [...this.nodes.values()].find((node) => node.userId === userId && node.id === nodeId) || null;
  }

  async traverse({ userId, nodeId, depth = 2, edgeTypes = [] }) {
    const start = await this.getNode(userId, nodeId);
    if (!start) return { nodes: [], edges: [] };

    const allowedEdgeTypes = new Set(edgeTypes);
    const frontier = [{ id: start.id, depth: 0 }];
    const visited = new Set([start.id]);
    const foundNodes = [start];
    const foundEdges = [];

    while (frontier.length) {
      const current = frontier.shift();
      if (current.depth >= depth) continue;

      for (const edge of this.edges.values()) {
        if (edge.userId !== userId) continue;
        if (allowedEdgeTypes.size && !allowedEdgeTypes.has(edge.type)) continue;

        const isForward = edge.sourceId === current.id;
        const isBackward = edge.targetId === current.id;
        if (!isForward && !isBackward) continue;

        foundEdges.push(edge);
        const neighborId = isForward ? edge.targetId : edge.sourceId;
        if (visited.has(neighborId)) continue;
        visited.add(neighborId);
        const neighbor = await this.getNode(userId, neighborId);
        if (neighbor) {
          foundNodes.push(neighbor);
          frontier.push({ id: neighborId, depth: current.depth + 1 });
        }
      }
    }

    return {
      nodes: uniqueBy(foundNodes, (node) => node.id),
      edges: uniqueBy(foundEdges, (edge) => edge.id),
    };
  }

  async searchNodes(userId, query, topK = 10) {
    const normalized = String(query).toLowerCase();
    return [...this.nodes.values()]
      .filter((node) => node.userId === userId)
      .map((node) => {
        const haystack = [node.title, node.summary, node.body, node.tags?.join(" "), node.lifeDomains?.join(" ")].filter(Boolean).join(" ");
        const score = haystack.toLowerCase().includes(normalized) ? 1 : 0;
        return { ...node, lexicalScore: score };
      })
      .sort((a, b) => b.lexicalScore - a.lexicalScore || (b.lastSeenAt || "").localeCompare(a.lastSeenAt || ""))
      .slice(0, topK);
  }

  async listEvolution(userId, nodeId) {
    return this.events.filter((event) => event.userId === userId && (!nodeId || event.reflectionId === nodeId));
  }

  async close() {
    return true;
  }
}

