export function materializeTraversal(startNodeId, graph) {
  const adjacency = new Map();
  for (const edge of graph.edges || []) {
    if (!adjacency.has(edge.sourceId)) adjacency.set(edge.sourceId, []);
    adjacency.get(edge.sourceId).push(edge.targetId);
    if (!adjacency.has(edge.targetId)) adjacency.set(edge.targetId, []);
    adjacency.get(edge.targetId).push(edge.sourceId);
  }

  const visited = new Set([startNodeId]);
  const frontier = [{ nodeId: startNodeId, depth: 0 }];
  const ordered = [];

  while (frontier.length) {
    const current = frontier.shift();
    ordered.push(current.nodeId);

    if (current.depth >= 2) continue;

    for (const neighbor of adjacency.get(current.nodeId) || []) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      frontier.push({ nodeId: neighbor, depth: current.depth + 1 });
    }
  }

  return ordered;
}

