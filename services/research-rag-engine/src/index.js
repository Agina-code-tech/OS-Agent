import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.js";
import { ResearchRagEngine } from "./pipeline/engine.js";
import { createResearchServer } from "./http/server.js";
import { InMemoryResearchStore } from "./stores/memory-store.js";
import { PostgresResearchStore } from "./stores/postgres-store.js";

function createStore(config) {
  return config.postgresUrl
    ? new PostgresResearchStore({ connectionString: config.postgresUrl })
    : new InMemoryResearchStore();
}

async function main() {
  const config = loadConfig();
  const store = createStore(config);
  await store.ensureSchema?.();

  const engine = new ResearchRagEngine({ store, config });
  await engine.ensureReady();

  const service = createResearchServer({
    engine,
    stores: { research: store },
    port: config.port,
  });

  await service.listen();
  console.log(`Research RAG Engine listening on http://localhost:${config.port}`);

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
