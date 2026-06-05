function json(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

async function readJson(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
  }
  return raw ? JSON.parse(raw) : {};
}

export function createOrchestratorRoutes(engine) {
  return async function handleRoute(req, res, url) {
    if (req.method === "GET" && url.pathname === "/healthz") {
      const health = await engine.health();
      json(res, 200, {
        ok: health.ok,
        service: "orchestrator",
        services: health.services,
      });
      return true;
    }

    if (req.method === "POST" && url.pathname === "/v1/orchestrate/reflection") {
      const body = await readJson(req);
      const result = await engine.orchestrateReflection(body);
      json(res, 200, result);
      return true;
    }

    if (req.method === "POST" && url.pathname === "/v1/orchestrate/search") {
      const body = await readJson(req);
      const result = await engine.search(body);
      json(res, 200, result);
      return true;
    }

    if (req.method === "POST" && url.pathname === "/v1/orchestrate/recall") {
      const body = await readJson(req);
      const result = await engine.recall(body);
      json(res, 200, result);
      return true;
    }

    return false;
  };
}

