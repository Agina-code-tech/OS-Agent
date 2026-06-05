import { normalizeQueryInput, normalizeReflectionInput } from "../domain/schema.js";

function json(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

export function createRoutes(engine, stores) {
  return async function handleRoute(req, res, url) {
    if (req.method === "GET" && url.pathname === "/healthz") {
      const [neo4j, postgres] = await Promise.all([
        stores.graph.healthCheck(),
        stores.backup.healthCheck(),
      ]);
      json(res, 200, { ok: true, service: "memory-graph-engine", neo4j, postgres });
      return true;
    }

    if (req.method === "POST" && url.pathname === "/v1/reflections/ingest") {
      const body = await readJson(req);
      const input = normalizeReflectionInput(body);
      const result = await engine.ingestReflection(input);
      json(res, 200, result);
      return true;
    }

    if (req.method === "POST" && url.pathname === "/v1/search") {
      const body = normalizeQueryInput(await readJson(req));
      const result = await engine.search(body);
      json(res, 200, result);
      return true;
    }

    if (req.method === "GET" && url.pathname === "/v1/graph/traverse") {
      const input = normalizeQueryInput({
        userId: url.searchParams.get("userId"),
        nodeId: url.searchParams.get("nodeId"),
        depth: url.searchParams.get("depth"),
        edgeTypes: url.searchParams.getAll("edgeType"),
      });
      const result = await engine.traverse(input);
      json(res, 200, result);
      return true;
    }

    if (req.method === "GET" && /^\/v1\/memories\/[^/]+$/.test(url.pathname)) {
      const id = decodeURIComponent(url.pathname.split("/").pop());
      const userId = url.searchParams.get("userId");
      if (!userId) {
        json(res, 400, { ok: false, error: "userId is required" });
        return true;
      }
      const memory = await engine.getMemory(userId, id);
      if (!memory) {
        json(res, 404, { ok: false, error: "Memory not found" });
        return true;
      }
      json(res, 200, { ok: true, memory });
      return true;
    }

    if (req.method === "GET" && /^\/v1\/memories\/[^/]+\/evolution$/.test(url.pathname)) {
      const id = decodeURIComponent(url.pathname.split("/")[3]);
      const userId = url.searchParams.get("userId");
      if (!userId) {
        json(res, 400, { ok: false, error: "userId is required" });
        return true;
      }
      const events = await engine.getEvolution(userId, id);
      json(res, 200, { ok: true, events });
      return true;
    }

    return false;
  };
}

async function readJson(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
  }
  return raw ? JSON.parse(raw) : {};
}
