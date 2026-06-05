import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.js";
import { NarrativeIntelligenceEngine } from "./pipeline/engine.js";
import { createNarrativeServer } from "./http/server.js";
import { InMemoryNarrativeStore } from "./stores/memory-store.js";
import { PostgresNarrativeStore } from "./stores/postgres-store.js";

function createStore(config) {
  return config.postgresUrl
    ? new PostgresNarrativeStore({ connectionString: config.postgresUrl })
    : new InMemoryNarrativeStore();
}

async function main() {
  const config = loadConfig();
  const store = createStore(config);
  await store.ensureSchema?.();

  const engine = new NarrativeIntelligenceEngine({ store, config });
  await engine.ensureReady();

  const service = createNarrativeServer({
    engine,
    stores: { narrative: store },
    port: config.port,
  });

  await service.listen();
  console.log(`Narrative Service listening on http://localhost:${config.port}`);

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
