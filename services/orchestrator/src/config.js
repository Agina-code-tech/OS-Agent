export function loadConfig(env = process.env) {
  return {
    port: Number(env.ORCHESTRATOR_PORT || env.PORT || 8093),
    memoryGraphUrl: env.ORCHESTRATOR_MEMORY_GRAPH_URL || env.MEMORY_GRAPH_URL || "http://127.0.0.1:8080",
    patternServiceUrl: env.ORCHESTRATOR_PATTERN_URL || env.PATTERN_SERVICE_URL || "http://127.0.0.1:8090",
    narrativeServiceUrl: env.ORCHESTRATOR_NARRATIVE_URL || env.NARRATIVE_SERVICE_URL || "http://127.0.0.1:8091",
    researchRagUrl: env.ORCHESTRATOR_RESEARCH_URL || env.RESEARCH_RAG_URL || "http://127.0.0.1:8092",
    timeoutMs: Number(env.ORCHESTRATOR_TIMEOUT_MS || 10000),
    retries: Number(env.ORCHESTRATOR_RETRIES || 1),
    topK: Number(env.ORCHESTRATOR_TOP_K || 5),
    nodeEnvironment: env.NODE_ENV || "development",
  };
}

