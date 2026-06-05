export function loadConfig(env = process.env) {
  return {
    port: Number(env.PORT || 8080),
    memoryExtractionMode: env.MEMORY_EXTRACTION_MODE || "hybrid",
    openAiApiKey: env.OPENAI_API_KEY || "",
    openAiExtractorModel: env.OPENAI_EXTRACTOR_MODEL || "gpt-5.5",
    openAiEmbeddingModel: env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
    neo4j: {
      uri: env.NEO4J_URI || "",
      user: env.NEO4J_USER || "",
      password: env.NEO4J_PASSWORD || "",
    },
    postgresUrl: env.POSTGRES_URL || "",
    memorySearchTopK: Number(env.MEMORY_SEARCH_TOP_K || 10),
    nodeEnvironment: env.NODE_ENV || "development",
  };
}

