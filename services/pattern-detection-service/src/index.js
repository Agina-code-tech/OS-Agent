import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.js";
import { PatternDetectionEngine } from "./pipeline/engine.js";
import { createPatternServer } from "./http/server.js";
import { InMemoryPatternStore } from "./stores/memory-store.js";
import { PostgresPatternStore } from "./stores/postgres-store.js";

function createStore(config) {
  return config.postgresUrl
    ? new PostgresPatternStore({ connectionString: config.postgresUrl })
    : new InMemoryPatternStore();
}

async function main() {
  const config = loadConfig();
  const store = createStore(config);
  await store.ensureSchema?.();

  const engine = new PatternDetectionEngine({ store, config });
  await engine.ensureReady();

  const service = createPatternServer({
    engine,
    stores: { pattern: store },
    port: config.port,
  });

  await service.listen();
  console.log(`Pattern Detection Service listening on http://localhost:${config.port}`);

  const shutdown = async () => {
    await service.close();
    await store.close?.();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

const currentFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : "";

if (currentFile === invokedFile) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
