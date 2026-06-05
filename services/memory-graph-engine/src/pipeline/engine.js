import { stableId, stableHash } from "../domain/text.js";
import { analyzeReflection } from "../extraction/heuristics.js";
import { createHashEmbedding } from "../embeddings/hash-vector.js";
import { scoreEdgeStrength } from "../graph/scoring.js";
import { searchMemoryGraph } from "../graph/search.js";

function buildCanonicalKey(userId, type, title) {
  return `${userId}:${type}:${stableHash(title).slice(0, 16)}`;
}

function buildNodeId(userId, type, title) {
  return stableId(type.toLowerCase(), userId, type, title);
}

function relationFor(sourceType, targetType, targetConceptType = "") {
  if (sourceType === "Memory") return "associated_with";
  if (sourceType === "Pattern" && targetType === "Goal") return "blocks";
  if (sourceType === "Value" && targetType === "Goal") return "strengthens";
  if (sourceType === "Belief" && targetType === "Value") return "supports";
  if (sourceType === "Belief" && targetType === "Goal") return "supports";
  if (sourceType === "Emotion" && targetType === "Belief") return "triggered_by";
  if (sourceType === "Narrative" && targetConceptType === "decision") return "evolved_into";
  if (sourceType === "Narrative" && targetConceptType === "insight") return "strengthens";
  if (sourceType === "LifeEvent") return "part_of";
  if (sourceType === "Person" && targetType === "Relationship") return "part_of";
  if (sourceType === "Project" && targetType === "Goal") return "supports";
  return "related_to";
}

function asProperties(node) {
  return {
    ...node.attributes,
    kind: node.kind,
    conceptType: node.conceptType,
    lifeDomains: node.lifeDomains || [],
    salience: node.salience,
    importance: node.importance,
    confidence: node.confidence,
  };
}

function buildNodesAndEdges(reflection, extractedNodes, queryEmbedding, capturedAt) {
  const nodes = [];
  const edges = [];
  const root = extractedNodes.find((node) => node.type === "Memory");

  for (const node of extractedNodes) {
    const canonicalKey = buildCanonicalKey(reflection.userId, node.type, node.title);
    const id = buildNodeId(reflection.userId, node.type, node.title);
    const embedding = createHashEmbedding(`${node.title} ${node.summary} ${node.body}`);
    const normalizedNode = {
      ...node,
      id,
      userId: reflection.userId,
      canonicalKey,
      contentHash: stableHash(node.body),
      firstSeenAt: capturedAt,
      lastSeenAt: capturedAt,
      embedding,
      properties: asProperties(node),
      temporalState: {
        capturedAt,
        source: reflection.source,
        reflectionId: reflection.reflectionId,
      },
    };
    nodes.push(normalizedNode);
  }

  const rootNode = nodes.find((node) => node.type === "Memory") || null;
  const nodeLookup = new Map(nodes.map((node) => [node.title, node]));

  for (const node of nodes) {
    if (!rootNode || node.id === rootNode.id) continue;
    edges.push({
      id: stableId("edge", reflection.userId, rootNode.id, node.id, "associated_with"),
      userId: reflection.userId,
      sourceId: rootNode.id,
      targetId: node.id,
      type: relationFor(rootNode.type, node.type, node.conceptType),
      canonicalKey: `${rootNode.id}:${node.id}:${relationFor(rootNode.type, node.type, node.conceptType)}`,
      strength: scoreEdgeStrength({
        confidence: node.confidence,
        intensity: node.salience,
        repetition: 1,
        distance: 0.2,
      }),
      confidence: node.confidence,
      evidence: node.evidence || [],
      properties: {
        sourceType: rootNode.type,
        targetType: node.type,
        conceptType: node.conceptType,
        createdBy: "memory-graph-engine",
      },
      firstSeenAt: capturedAt,
      validFrom: capturedAt,
    });
  }

  const beliefs = nodes.filter((node) => node.type === "Belief");
  const values = nodes.filter((node) => node.type === "Value");
  const goals = nodes.filter((node) => node.type === "Goal");
  const emotions = nodes.filter((node) => node.type === "Emotion");
  const patterns = nodes.filter((node) => node.type === "Pattern");
  const narratives = nodes.filter((node) => node.type === "Narrative");
  const persons = nodes.filter((node) => node.type === "Person");
  const relationships = nodes.filter((node) => node.type === "Relationship");
  const projects = nodes.filter((node) => node.type === "Project");
  const events = nodes.filter((node) => node.type === "LifeEvent");

  for (const emotion of emotions) {
    for (const belief of beliefs) {
      edges.push({
        id: stableId("edge", emotion.id, belief.id, "triggered_by"),
        userId: reflection.userId,
        sourceId: emotion.id,
        targetId: belief.id,
        type: "triggered_by",
        canonicalKey: `${emotion.id}:${belief.id}:triggered_by`,
        strength: scoreEdgeStrength({ confidence: 0.72, intensity: emotion.salience, repetition: 1, distance: 0.1 }),
        confidence: 0.72,
        evidence: [...emotion.evidence, ...belief.evidence],
        properties: { rule: "emotion-to-belief" },
        firstSeenAt: capturedAt,
        validFrom: capturedAt,
      });
    }
  }

  for (const belief of beliefs) {
    for (const value of values) {
      edges.push({
        id: stableId("edge", belief.id, value.id, "supports"),
        userId: reflection.userId,
        sourceId: belief.id,
        targetId: value.id,
        type: /not\b|never\b|can't\b|cannot\b|won't\b/i.test(belief.body) ? "contradicts" : "supports",
        canonicalKey: `${belief.id}:${value.id}:belief-value`,
        strength: scoreEdgeStrength({ confidence: belief.confidence, intensity: value.salience, repetition: 1, distance: 0.2 }),
        confidence: belief.confidence,
        evidence: [...belief.evidence, ...value.evidence],
        properties: { rule: "belief-to-value" },
        firstSeenAt: capturedAt,
        validFrom: capturedAt,
      });
    }

    for (const goal of goals) {
      edges.push({
        id: stableId("edge", belief.id, goal.id, "supports"),
        userId: reflection.userId,
        sourceId: belief.id,
        targetId: goal.id,
        type: /not\b|never\b|can't\b|cannot\b|won't\b/i.test(belief.body) ? "blocks" : "supports",
        canonicalKey: `${belief.id}:${goal.id}:belief-goal`,
        strength: scoreEdgeStrength({ confidence: belief.confidence, intensity: goal.salience, repetition: 1, distance: 0.2 }),
        confidence: belief.confidence,
        evidence: [...belief.evidence, ...goal.evidence],
        properties: { rule: "belief-to-goal" },
        firstSeenAt: capturedAt,
        validFrom: capturedAt,
      });
    }
  }

  for (const pattern of patterns) {
    for (const goal of goals) {
      edges.push({
        id: stableId("edge", pattern.id, goal.id, "blocks"),
        userId: reflection.userId,
        sourceId: pattern.id,
        targetId: goal.id,
        type: "blocks",
        canonicalKey: `${pattern.id}:${goal.id}:blocks`,
        strength: scoreEdgeStrength({ confidence: pattern.confidence, intensity: pattern.salience, repetition: 2, distance: 0.15 }),
        confidence: pattern.confidence,
        evidence: [...pattern.evidence, ...goal.evidence],
        properties: { rule: "pattern-blocks-goal" },
        firstSeenAt: capturedAt,
        validFrom: capturedAt,
      });
    }
  }

  for (const value of values) {
    for (const goal of goals) {
      edges.push({
        id: stableId("edge", value.id, goal.id, "strengthens"),
        userId: reflection.userId,
        sourceId: value.id,
        targetId: goal.id,
        type: "strengthens",
        canonicalKey: `${value.id}:${goal.id}:strengthens`,
        strength: scoreEdgeStrength({ confidence: value.confidence, intensity: goal.salience, repetition: 1, distance: 0.2 }),
        confidence: value.confidence,
        evidence: [...value.evidence, ...goal.evidence],
        properties: { rule: "value-strengthens-goal" },
        firstSeenAt: capturedAt,
        validFrom: capturedAt,
      });
    }
  }

  for (const narrative of narratives) {
    for (const goal of goals) {
      edges.push({
        id: stableId("edge", narrative.id, goal.id, narrative.conceptType === "decision" ? "evolved_into" : "supports"),
        userId: reflection.userId,
        sourceId: narrative.id,
        targetId: goal.id,
        type: narrative.conceptType === "decision" ? "evolved_into" : "strengthens",
        canonicalKey: `${narrative.id}:${goal.id}:${narrative.conceptType}`,
        strength: scoreEdgeStrength({ confidence: narrative.confidence, intensity: narrative.salience, repetition: 1, distance: 0.25 }),
        confidence: narrative.confidence,
        evidence: narrative.evidence,
        properties: { rule: "narrative-to-goal", conceptType: narrative.conceptType },
        firstSeenAt: capturedAt,
        validFrom: capturedAt,
      });
    }
  }

  for (const project of projects) {
    for (const goal of goals) {
      edges.push({
        id: stableId("edge", project.id, goal.id, "supports"),
        userId: reflection.userId,
        sourceId: project.id,
        targetId: goal.id,
        type: "supports",
        canonicalKey: `${project.id}:${goal.id}:supports`,
        strength: scoreEdgeStrength({ confidence: project.confidence, intensity: goal.salience, repetition: 1, distance: 0.25 }),
        confidence: project.confidence,
        evidence: [...project.evidence, ...goal.evidence],
        properties: { rule: "project-supports-goal" },
        firstSeenAt: capturedAt,
        validFrom: capturedAt,
      });
    }
  }

  for (const person of persons) {
    for (const relationship of relationships) {
      edges.push({
        id: stableId("edge", person.id, relationship.id, "part_of"),
        userId: reflection.userId,
        sourceId: person.id,
        targetId: relationship.id,
        type: "part_of",
        canonicalKey: `${person.id}:${relationship.id}:part_of`,
        strength: scoreEdgeStrength({ confidence: person.confidence, intensity: relationship.salience, repetition: 1, distance: 0.15 }),
        confidence: person.confidence,
        evidence: [...person.evidence, ...relationship.evidence],
        properties: { rule: "person-part-of-relationship" },
        firstSeenAt: capturedAt,
        validFrom: capturedAt,
      });
    }
  }

  for (const event of events) {
    edges.push({
      id: stableId("edge", rootNode.id, event.id, "part_of"),
      userId: reflection.userId,
      sourceId: event.id,
      targetId: rootNode.id,
      type: "part_of",
      canonicalKey: `${event.id}:${rootNode.id}:part_of`,
      strength: scoreEdgeStrength({ confidence: event.confidence, intensity: event.salience, repetition: 1, distance: 0.1 }),
      confidence: event.confidence,
      evidence: event.evidence,
      properties: { rule: "event-part-of-memory" },
      firstSeenAt: capturedAt,
      validFrom: capturedAt,
    });
  }

  const dedupedEdges = new Map();
  for (const edge of edges) {
    if (!dedupedEdges.has(edge.canonicalKey)) {
      dedupedEdges.set(edge.canonicalKey, edge);
    } else {
      const existing = dedupedEdges.get(edge.canonicalKey);
      dedupedEdges.set(edge.canonicalKey, {
        ...existing,
        strength: Math.max(existing.strength, edge.strength),
        confidence: Math.max(existing.confidence, edge.confidence),
        evidence: [...new Set([...(existing.evidence || []), ...(edge.evidence || [])])],
      });
    }
  }

  return {
    nodes,
    edges: [...dedupedEdges.values()],
    queryEmbedding,
  };
}

export class MemoryGraphEngine {
  constructor({ graphStore, backupStore, config }) {
    this.graphStore = graphStore;
    this.backupStore = backupStore;
    this.config = config;
  }

  async ingestReflection(input) {
    const normalized = analyzeReflection(input);
    const savedReflection = await this.backupStore.saveReflection({
      reflectionId: input.reflectionId || stableId("ref", input.userId, input.text, input.occurredAt),
      userId: input.userId,
      rawText: input.text,
      normalizedText: normalized.reflection.normalizedText,
      source: input.source,
      metadata: input.metadata,
      occurredAt: input.occurredAt,
    });

    const { nodes, edges, queryEmbedding } = buildNodesAndEdges(
      {
        userId: input.userId,
        reflectionId: savedReflection.reflectionId,
        source: input.source,
      },
      normalized.nodes,
      null,
      savedReflection.occurredAt,
    );

    const graphResult = await this.graphStore.upsertGraph({
      userId: input.userId,
      reflectionId: savedReflection.reflectionId,
      revision: savedReflection.graphRevision,
      nodes,
      edges,
      capturedAt: savedReflection.occurredAt,
    });

    await this.backupStore.upsertNodes(input.userId, savedReflection.reflectionId, nodes, savedReflection.occurredAt);
    await this.backupStore.upsertEdges(input.userId, savedReflection.reflectionId, edges, savedReflection.occurredAt);
    await this.backupStore.appendEvent({
      id: stableId("evt", input.userId, savedReflection.reflectionId, savedReflection.graphRevision),
      userId: input.userId,
      eventType: "reflection_ingested",
      reflectionId: savedReflection.reflectionId,
      entityType: "Memory",
      entityId: nodes[0]?.id || null,
      graphRevision: savedReflection.graphRevision,
      payload: {
        nodeCount: nodes.length,
        edgeCount: edges.length,
        domains: normalized.reflection.domains,
        emotions: normalized.reflection.emotionSignals.map((signal) => signal.label),
      },
      createdAt: savedReflection.occurredAt,
    });

    const searchPreview = await searchMemoryGraph({
      userId: input.userId,
      query: normalized.reflection.summary,
      topK: 3,
      backupStore: this.backupStore,
      graphStore: this.graphStore,
      domains: normalized.reflection.domains,
    });

    return {
      ok: true,
      reflectionId: savedReflection.reflectionId,
      graphRevision: savedReflection.graphRevision,
      nodesUpserted: graphResult.nodeCount,
      edgesUpserted: graphResult.edgeCount,
      summary: normalized.reflection.summary,
      domains: normalized.reflection.domains,
      emotions: normalized.reflection.emotionSignals.map((signal) => signal.label),
      preview: searchPreview.results.slice(0, 3).map((node) => ({
        id: node.id,
        title: node.title,
        score: node.score,
        type: node.type,
      })),
    };
  }

  async search(input) {
    return searchMemoryGraph({
      userId: input.userId,
      query: input.query,
      topK: input.topK,
      backupStore: this.backupStore,
      graphStore: this.graphStore,
      domains: input.domains || [],
    });
  }

  async traverse(input) {
    return this.graphStore.traverse({
      userId: input.userId,
      nodeId: input.nodeId,
      depth: input.depth || 2,
      edgeTypes: input.edgeTypes || [],
    });
  }

  async getMemory(userId, id) {
    return this.backupStore.getMemoryById(userId, id);
  }

  async getEvolution(userId, nodeId) {
    return this.backupStore.listEvolution(userId, nodeId);
  }
}

