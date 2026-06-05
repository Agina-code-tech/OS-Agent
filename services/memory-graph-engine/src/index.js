import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.js";
import { MemoryGraphEngine } from "./pipeline/engine.js";
import { createMemoryGraphServer } from "./http/server.js";
import { Neo4jMemoryGraphStore } from "./graph/neo4j-store.js";
import { PostgresMemoryBackupStore } from "./graph/postgres-store.js";
import { InMemoryGraphStore } from "./graph/in-memory-store.js";
import { MemoryBackupStore } from "./graph/memory-backup-store.js";

function createStores(config) {
  const graphStore = config.neo4j.uri && config.neo4j.user && config.neo4j.password
    ? new Neo4jMemoryGraphStore(config.neo4j)
    : new InMemoryGraphStore();

  const backupStore = config.postgresUrl
    ? new PostgresMemoryBackupStore({ connectionString: config.postgresUrl })
    : new MemoryBackupStore();

  return { graphStore, backupStore };
}

async function main() {
  const config = loadConfig();
  const stores = createStores(config);
  await Promise.all([
    stores.graphStore.ensureSchema?.(),
    stores.backupStore.ensureSchema?.(),
  ]);

  const engine = new MemoryGraphEngine({
    graphStore: stores.graphStore,
    backupStore: stores.backupStore,
    config,
  });

  const service = createMemoryGraphServer({
    engine,
    stores: { graph: stores.graphStore, backup: stores.backupStore },
    port: config.port,
  });

  await service.listen();
  console.log(`Memory Graph Engine listening on http://localhost:${config.port}`);

  const shutdown = async () => {
    await service.close();
    await stores.graphStore.close?.();
    await stores.backupStore.close?.();
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
