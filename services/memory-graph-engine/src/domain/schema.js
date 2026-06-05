import { EDGE_TYPES, NODE_TYPES } from "./constants.js";

export function assertNodeType(type) {
  if (!NODE_TYPES.includes(type)) {
    throw new Error(`Invalid node type: ${type}`);
  }
  return type;
}

export function assertEdgeType(type) {
  if (!EDGE_TYPES.includes(type)) {
    throw new Error(`Invalid edge type: ${type}`);
  }
  return type;
}

export function normalizeReflectionInput(input = {}) {
  const userId = String(input.userId || "").trim();
  const text = String(input.text || "").trim();

  if (!userId) throw new Error("userId is required");
  if (!text) throw new Error("text is required");

  return {
    userId,
    text,
    reflectionId: input.reflectionId ? String(input.reflectionId) : undefined,
    source: input.source ? String(input.source) : "reflection",
    metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : {},
    occurredAt: input.occurredAt ? new Date(input.occurredAt).toISOString() : new Date().toISOString(),
    domains: Array.isArray(input.domains) ? input.domains : [],
  };
}

export function normalizeQueryInput(input = {}) {
  const userId = String(input.userId || "").trim();
  const query = String(input.query || "").trim();

  if (!userId) throw new Error("userId is required");
  if (!query) throw new Error("query is required");

  return {
    userId,
    query,
    topK: Number.isFinite(Number(input.topK)) ? Math.max(1, Math.min(100, Number(input.topK))) : 10,
    depth: Number.isFinite(Number(input.depth)) ? Math.max(1, Math.min(4, Number(input.depth))) : 2,
    nodeId: input.nodeId ? String(input.nodeId) : undefined,
    edgeTypes: Array.isArray(input.edgeTypes) ? input.edgeTypes.filter((edgeType) => EDGE_TYPES.includes(edgeType)) : [],
  };
}

