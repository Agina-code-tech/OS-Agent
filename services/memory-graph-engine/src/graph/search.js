import { createHashEmbedding } from "../embeddings/hash-vector.js";
import { cosineSimilarity } from "../domain/text.js";
import { scoreMemoryNode } from "./scoring.js";

export async function searchMemoryGraph({ userId, query, topK = 10, backupStore, graphStore, domains = [] }) {
  const queryEmbedding = createHashEmbedding(query);
  const lexicalCandidates = await backupStore.searchNodes({ userId, query, topK: Math.max(topK * 2, 20), domains });
  const scored = lexicalCandidates.map((node) => ({
    ...node,
    querySimilarity: node.embedding ? cosineSimilarity(queryEmbedding, node.embedding) : 0.35,
    score: scoreMemoryNode(node, { queryEmbedding, domain: domains.join(" "), emotionIntensity: node.properties?.emotionIntensity }),
  }));

  scored.sort((a, b) => b.score - a.score || b.querySimilarity - a.querySimilarity || (b.lastSeenAt || "").localeCompare(a.lastSeenAt || ""));

  const topNodes = scored.slice(0, topK);
  const neighborhoods = [];

  if (graphStore?.traverse) {
    for (const node of topNodes.slice(0, Math.min(3, topNodes.length))) {
      const neighborhood = await graphStore.traverse({ userId, nodeId: node.id, depth: 2 });
      neighborhoods.push({
        centerNodeId: node.id,
        nodes: neighborhood.nodes,
        edges: neighborhood.edges,
      });
    }
  }

  return {
    query,
    topK,
    results: topNodes,
    neighborhoods,
    queryEmbedding,
  };
}

