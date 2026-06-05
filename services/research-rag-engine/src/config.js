export function loadConfig(env = process.env) {
  return {
    port: Number(env.RESEARCH_RAG_PORT || env.PORT || 8092),
    postgresUrl: env.RESEARCH_RAG_POSTGRES_URL || env.POSTGRES_URL || "",
    nodeEnvironment: env.NODE_ENV || "development",
    openAiApiKey: env.OPENAI_API_KEY || "",
    embeddingModel: env.RESEARCH_RAG_EMBEDDING_MODEL || env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
    vectorDimension: Number(env.RESEARCH_RAG_VECTOR_DIMENSION || 1536),
    topK: Number(env.RESEARCH_RAG_TOP_K || 6),
    contextBudget: Number(env.RESEARCH_RAG_CONTEXT_BUDGET || 1800),
    chunkWords: Number(env.RESEARCH_RAG_CHUNK_WORDS || 220),
    chunkOverlap: Number(env.RESEARCH_RAG_CHUNK_OVERLAP || 40),
    evaluationName: env.RESEARCH_RAG_EVALUATION_NAME || "research-rag-benchmark",
  };
}
