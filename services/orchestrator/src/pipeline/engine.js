import { buildFocusQuery, buildReflectionUnderstanding, normalizeOrchestratorInput } from "../domain/reflection.js";
import { buildServiceClients } from "../clients/http-client.js";

function settledPayload(result) {
  if (result.status === "fulfilled") return result.value;
  return {
    ok: false,
    error: result.reason instanceof Error ? result.reason.message : String(result.reason || "Request failed"),
  };
}

function bestItems(response, key = "results", limit = 3) {
  const items = response?.payload?.[key] || response?.[key] || [];
  return Array.isArray(items) ? items.slice(0, limit) : [];
}

export class OrchestrationEngine {
  constructor({ clients = null, config = {}, understandingBuilder = buildReflectionUnderstanding } = {}) {
    this.config = {
      timeoutMs: Number(config.timeoutMs || 10000),
      retries: Number(config.retries || 1),
      topK: Number(config.topK || 5),
      ...config,
    };
    this.understandingBuilder = understandingBuilder;
    this.clients = clients || buildServiceClients(config);
  }

  async health() {
    const checks = await Promise.allSettled([
      this.clients.memory.get("/healthz"),
      this.clients.pattern.get("/healthz"),
      this.clients.narrative.get("/healthz"),
      this.clients.research.get("/healthz"),
    ]);

    return {
      ok: checks.every((check) => settledPayload(check).ok),
      services: {
        memory: settledPayload(checks[0]),
        pattern: settledPayload(checks[1]),
        narrative: settledPayload(checks[2]),
        research: settledPayload(checks[3]),
      },
    };
  }

  async orchestrateReflection(input = {}) {
    const reflection = normalizeOrchestratorInput(input);
    const understanding = this.understandingBuilder(reflection);
    const researchQuery = buildFocusQuery(reflection, understanding.themes, understanding.sentences);
    const payload = {
      ...reflection,
      metadata: {
        ...reflection.metadata,
        orchestration: {
          requestId: reflection.requestId,
          summary: understanding.summary,
          themes: understanding.themes,
          sentiment: understanding.sentiment,
        },
      },
    };

    const [memory, pattern, narrative, research] = await Promise.allSettled([
      this.clients.memory.post("/v1/reflections/ingest", payload),
      this.clients.pattern.post("/v1/patterns/ingest", payload),
      this.clients.narrative.post("/v1/narratives/ingest", payload),
      this.clients.research.post("/v1/retrieve", {
        query: researchQuery,
        topK: this.config.topK,
        frameworks: reflection.metadata?.researchFrameworks || [],
      }),
    ]);

    const services = {
      memory: settledPayload(memory),
      pattern: settledPayload(pattern),
      narrative: settledPayload(narrative),
      research: settledPayload(research),
    };

    return {
      ok: true,
      mode: "reflection",
      userId: reflection.userId,
      requestId: reflection.requestId,
      reflection,
      understanding,
      services,
      highlights: {
        memory: services.memory.ok ? services.memory.payload || services.memory : services.memory,
        pattern: services.pattern.ok ? services.pattern.payload || services.pattern : services.pattern,
        narrative: services.narrative.ok ? services.narrative.payload || services.narrative : services.narrative,
        research: services.research.ok ? services.research.payload || services.research : services.research,
      },
      summary: {
        themes: understanding.themes,
        sentiment: understanding.sentiment,
        researchSources: bestItems(services.research, "results", 3).length,
        patternDetections: services.pattern?.payload?.detectedCount || 0,
        narrativeDetections: services.narrative?.payload?.detectedCount || 0,
      },
    };
  }

  async search(input = {}) {
    const query = String(input.query || input.text || "").trim();
    const userId = String(input.userId || "").trim();
    if (!userId) throw new Error("userId is required");
    if (!query) throw new Error("query is required");

    const [memory, pattern, narrative, research] = await Promise.allSettled([
      this.clients.memory.post("/v1/search", {
        userId,
        query,
        topK: input.topK || this.config.topK,
      }),
      this.clients.pattern.get("/v1/search", {
        searchParams: { userId, q: query },
      }),
      this.clients.narrative.get("/v1/search", {
        searchParams: { userId, q: query },
      }),
      this.clients.research.get("/v1/search", {
        searchParams: { q: query, topK: String(input.topK || this.config.topK) },
      }),
    ]);

    const services = {
      memory: settledPayload(memory),
      pattern: settledPayload(pattern),
      narrative: settledPayload(narrative),
      research: settledPayload(research),
    };

    return {
      ok: true,
      mode: "search",
      userId,
      query,
      services,
      summary: {
        memoryHits: services.memory?.payload?.results?.length || services.memory?.results?.length || 0,
        patternHits: services.pattern?.payload?.results?.length || services.pattern?.results?.length || 0,
        narrativeHits: services.narrative?.payload?.results?.length || services.narrative?.results?.length || 0,
        researchHits: services.research?.payload?.results?.length || services.research?.results?.length || 0,
      },
    };
  }

  async recall(input = {}) {
    const userId = String(input.userId || "").trim();
    if (!userId) throw new Error("userId is required");

    const query = String(input.query || input.text || "").trim();
    const nodeId = input.nodeId ? String(input.nodeId) : undefined;
    const patternId = input.patternId ? String(input.patternId) : undefined;
    const narrativeId = input.narrativeId ? String(input.narrativeId) : undefined;

    const tasks = [];
    if (nodeId) {
      tasks.push({
        key: "memoryTraverse",
        promise: this.clients.memory.get("/v1/graph/traverse", {
          searchParams: [
            ["userId", userId],
            ["nodeId", nodeId],
            ["depth", String(input.depth || 2)],
            ...(Array.isArray(input.edgeTypes) ? input.edgeTypes.map((edgeType) => ["edgeType", edgeType]) : []),
          ],
        }),
      });
    }

    if (query) {
      tasks.push({
        key: "memorySearch",
        promise: this.clients.memory.post("/v1/search", {
          userId,
          query,
          topK: input.topK || this.config.topK,
        }),
      });
    }

    if (patternId) {
      tasks.push({
        key: "patternOccurrences",
        promise: this.clients.pattern.get(`/v1/patterns/${encodeURIComponent(patternId)}/occurrences`, {
          searchParams: { userId },
        }),
      });
    }

    if (narrativeId) {
      tasks.push({
        key: "narrativeOccurrences",
        promise: this.clients.narrative.get(`/v1/narratives/${encodeURIComponent(narrativeId)}/occurrences`, {
          searchParams: { userId },
        }),
      });
    }

    if (query) {
      tasks.push({
        key: "research",
        promise: this.clients.research.post("/v1/retrieve", {
          query,
          topK: input.topK || this.config.topK,
        }),
      });
    }

    const settled = await Promise.allSettled(tasks.map((task) => task.promise));
    const responses = {};
    settled.forEach((result, index) => {
      responses[tasks[index].key] = settledPayload(result);
    });

    return {
      ok: true,
      mode: "recall",
      userId,
      query: query || null,
      services: {
        memoryTraverse: responses.memoryTraverse || { ok: false, skipped: true },
        memorySearch: responses.memorySearch || { ok: false, skipped: true },
        patternOccurrences: responses.patternOccurrences || { ok: false, skipped: true },
        narrativeOccurrences: responses.narrativeOccurrences || { ok: false, skipped: true },
        research: responses.research || { ok: false, skipped: true },
      },
      summary: {
        memoryHits: responses.memorySearch?.payload?.results?.length || responses.memorySearch?.results?.length || 0,
        researchSources: responses.research?.payload?.results?.length || responses.research?.results?.length || 0,
        patternOccurrences: responses.patternOccurrences?.payload?.total || responses.patternOccurrences?.total || 0,
        narrativeOccurrences: responses.narrativeOccurrences?.payload?.total || responses.narrativeOccurrences?.total || 0,
      },
    };
  }
}
