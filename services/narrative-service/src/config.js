export function loadConfig(env = process.env) {
  return {
    port: Number(env.NARRATIVE_PORT || env.PORT || 8091),
    postgresUrl: env.NARRATIVE_POSTGRES_URL || env.POSTGRES_URL || "",
    nodeEnvironment: env.NODE_ENV || "development",
    maxSearchResults: Number(env.NARRATIVE_MAX_SEARCH_RESULTS || 25),
    reportLookbackMultiplier: Number(env.NARRATIVE_REPORT_LOOKBACK_MULTIPLIER || 2),
  };
}
