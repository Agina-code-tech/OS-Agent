import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.js";
import { OrchestrationEngine } from "./pipeline/engine.js";
import { createOrchestratorServer } from "./http/server.js";

async function main() {
  const config = loadConfig();
  const engine = new OrchestrationEngine({ config });
  const service = createOrchestratorServer({ engine, port: config.port });

  await service.listen();
  console.log(`Orchestrator listening on http://localhost:${config.port}`);

  const shutdown = async () => {
    await service.close();
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

