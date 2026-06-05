export function loadConfig(env = process.env) {
  return {
    port: Number(env.PATTERN_PORT || env.PORT || 8090),
    postgresUrl: env.PATTERN_POSTGRES_URL || env.POSTGRES_URL || "",
    nodeEnvironment: env.NODE_ENV || "development",
    maxSearchResults: Number(env.PATTERN_MAX_SEARCH_RESULTS || 25),
    reportLookbackMultiplier: Number(env.PATTERN_REPORT_LOOKBACK_MULTIPLIER || 2),
  };
}
