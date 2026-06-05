import neo4j from "neo4j-driver";
import { EDGE_TYPES, NODE_TYPES } from "../domain/constants.js";

function sanitizeLabel(type) {
  if (!NODE_TYPES.includes(type)) {
    throw new Error(`Unsupported node type: ${type}`);
  }
  return type;
}

function sanitizeEdgeType(type) {
  if (!EDGE_TYPES.includes(type)) {
    throw new Error(`Unsupported edge type: ${type}`);
  }
  return type;
}

export class Neo4jMemoryGraphStore {
  constructor({ uri, user, password } = {}) {
    this.enabled = Boolean(uri && user && password);
    this.driver = this.enabled
      ? neo4j.driver(uri, neo4j.auth.basic(user, password), {
          disableLosslessIntegers: true,
        })
      : null;
  }

  static disabled() {
    return new Neo4jMemoryGraphStore({});
  }

  async ensureSchema() {
    if (!this.driver) return true;

    const session = this.driver.session({ defaultAccessMode: neo4j.session.WRITE });
    try {
      await session.run("CREATE CONSTRAINT memory_node_canonical IF NOT EXISTS FOR (n:Memory) REQUIRE (n.userId, n.canonicalKey) IS UNIQUE");
      await session.run("CREATE INDEX memory_node_user_id IF NOT EXISTS FOR (n:Memory) ON (n.userId)");
      await session.run("CREATE INDEX memory_node_label IF NOT EXISTS FOR (n:Memory) ON (n.label)");
    } finally {
      await session.close();
    }

    return true;
  }

  async healthCheck() {
    if (!this.driver) {
      return { ok: false, provider: "neo4j", reason: "disabled" };
    }

    const session = this.driver.session({ defaultAccessMode: neo4j.session.READ });
    try {
      await session.run("RETURN 1 AS ok");
      return { ok: true, provider: "neo4j" };
    } finally {
      await session.close();
    }
  }

  async upsertGraph({ userId, reflectionId, revision, nodes = [], edges = [], capturedAt }) {
    if (!this.driver) {
      return { nodeCount: nodes.length, edgeCount: edges.length, revision };
    }

    const session = this.driver.session({ defaultAccessMode: neo4j.session.WRITE });
    try {
      await session.executeWrite(async (tx) => {
        for (const node of nodes) {
          const labels = `:${sanitizeLabel(node.type)}`;
          const query = `
            MERGE (n:Memory${labels} { userId: $userId, canonicalKey: $canonicalKey })
            SET n.id = $id,
                n.label = $label,
                n.title = $title,
                n.summary = $summary,
                n.body = $body,
                n.sourceReflectionId = $reflectionId,
                n.contentHash = $contentHash,
                n.confidence = $confidence,
                n.importance = $importance,
                n.salience = $salience,
                n.firstSeenAt = coalesce(n.firstSeenAt, $capturedAt),
                n.lastSeenAt = $capturedAt,
                n.version = coalesce(n.version, 0) + 1,
                n.temporalState = $temporalState,
                n.tags = $tags,
                n.embedding = $embedding,
                n.lifeDomains = $lifeDomains,
                n.conceptType = $conceptType,
                n.kind = $kind,
                n.properties = $properties
          `;

          await tx.run(query, {
            userId,
            canonicalKey: node.canonicalKey,
            id: node.id,
            label: node.type,
            title: node.title,
            summary: node.summary,
            body: node.body,
            reflectionId,
            contentHash: node.contentHash,
            confidence: node.confidence,
            importance: node.importance,
            salience: node.salience,
            capturedAt,
            temporalState: node.temporalState,
            tags: node.tags || [],
            embedding: node.embedding || [],
            lifeDomains: node.lifeDomains || [],
            conceptType: node.conceptType || node.kind || node.type.toLowerCase(),
            kind: node.kind || node.type.toLowerCase(),
            properties: node.properties || {},
          });
        }

        for (const edge of edges) {
          const relType = sanitizeEdgeType(edge.type);
          const query = `
            MATCH (source:Memory { userId: $userId, id: $sourceId })
            MATCH (target:Memory { userId: $userId, id: $targetId })
            MERGE (source)-[r:${relType} { userId: $userId, canonicalKey: $canonicalKey }]->(target)
            SET r.id = $id,
                r.sourceNodeId = $sourceId,
                r.targetNodeId = $targetId,
                r.strength = $strength,
                r.confidence = $confidence,
                r.evidence = $evidence,
                r.properties = $properties,
                r.firstSeenAt = coalesce(r.firstSeenAt, $capturedAt),
                r.lastSeenAt = $capturedAt,
                r.version = coalesce(r.version, 0) + 1,
                r.validFrom = coalesce(r.validFrom, $capturedAt),
                r.validTo = $validTo,
                r.sourceReflectionId = $reflectionId
          `;

          await tx.run(query, {
            userId,
            id: edge.id,
            sourceId: edge.sourceId,
            targetId: edge.targetId,
            canonicalKey: edge.canonicalKey,
            strength: edge.strength,
            confidence: edge.confidence,
            evidence: edge.evidence || [],
            properties: edge.properties || {},
            capturedAt,
            validTo: edge.validTo || null,
            reflectionId,
          });
        }
      });

      return { nodeCount: nodes.length, edgeCount: edges.length, revision };
    } finally {
      await session.close();
    }
  }

  async traverse({ userId, nodeId, depth = 2, edgeTypes = [] }) {
    if (!this.driver) return { nodes: [], edges: [] };

    const relFilter = edgeTypes.length ? `:${edgeTypes.map(sanitizeEdgeType).join("|")}` : "";
    const query = `
      MATCH (start:Memory { userId: $userId, id: $nodeId })
      MATCH path = (start)-[r${relFilter}*1..${depth}]-(neighbor)
      WHERE all(n IN nodes(path) WHERE n.userId = $userId)
      WITH collect(path) AS paths
      UNWIND paths AS path
      UNWIND nodes(path) AS n
      UNWIND relationships(path) AS rel
      RETURN collect(DISTINCT n) AS nodes, collect(DISTINCT rel) AS edges
    `;

    const session = this.driver.session({ defaultAccessMode: neo4j.session.READ });
    try {
      const result = await session.run(query, { userId, nodeId });
      const record = result.records[0];
      if (!record) return { nodes: [], edges: [] };
      return {
        nodes: record.get("nodes").map((node) => node.properties),
        edges: record.get("edges").map((edge) => edge.properties),
      };
    } finally {
      await session.close();
    }
  }

  async close() {
    if (this.driver) await this.driver.close();
  }
}
