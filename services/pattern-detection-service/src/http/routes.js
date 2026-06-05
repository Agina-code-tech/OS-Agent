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

function readQuery(url, key) {
  const value = url.searchParams.get(key);
  return value === null ? undefined : value;
}

function normalizeIngestBody(body = {}) {
  return {
    ...body,
    text: body.text ?? body.content ?? body.transcript ?? body.note ?? "",
    sourceType: body.sourceType ?? body.source_type ?? body.kind ?? "reflection",
    sourceId: body.sourceId ?? body.source_id ?? null,
    occurredAt: body.occurredAt ?? body.occurred_at ?? body.timestamp ?? null,
    metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {},
  };
}

export function createPatternRoutes(engine, stores) {
  return async function handleRoute(req, res, url) {
    if (req.method === "GET" && url.pathname === "/healthz") {
      const storeHealth = await engine.health();
      json(res, 200, {
        ok: true,
        service: "pattern-detection-service",
        store: storeHealth,
      });
      return true;
    }

    if (req.method === "POST" && url.pathname === "/v1/patterns/ingest") {
      const body = normalizeIngestBody(await readJson(req));
      const result = await engine.ingest(body);
      json(res, 200, result);
      return true;
    }

    if (req.method === "GET" && url.pathname === "/v1/patterns") {
      const userId = readQuery(url, "userId");
      if (!userId) {
        json(res, 400, { ok: false, error: "userId is required" });
        return true;
      }
      const filters = {
        family: readQuery(url, "family"),
        status: readQuery(url, "status"),
        sourceType: readQuery(url, "sourceType"),
      };
      const patterns = await engine.listPatterns(userId, filters);
      json(res, 200, { ok: true, userId, total: patterns.length, patterns });
      return true;
    }

    if (req.method === "GET" && url.pathname === "/v1/search") {
      const userId = readQuery(url, "userId");
      if (!userId) {
        json(res, 400, { ok: false, error: "userId is required" });
        return true;
      }
      const result = await engine.search(userId, readQuery(url, "q") || "");
      json(res, 200, result);
      return true;
    }

    if (req.method === "GET" && /^\/v1\/patterns\/[^/]+$/.test(url.pathname)) {
      const patternId = decodeURIComponent(url.pathname.split("/").pop());
      const userId = readQuery(url, "userId");
      if (!userId) {
        json(res, 400, { ok: false, error: "userId is required" });
        return true;
      }
      const pattern = await engine.getPattern(userId, patternId);
      if (!pattern) {
        json(res, 404, { ok: false, error: "Pattern not found" });
        return true;
      }
      json(res, 200, { ok: true, pattern });
      return true;
    }

    if (req.method === "GET" && /^\/v1\/patterns\/[^/]+\/occurrences$/.test(url.pathname)) {
      const patternId = decodeURIComponent(url.pathname.split("/")[3]);
      const userId = readQuery(url, "userId");
      if (!userId) {
        json(res, 400, { ok: false, error: "userId is required" });
        return true;
      }
      const occurrences = await engine.getOccurrences(userId, patternId);
      json(res, 200, { ok: true, userId, patternId, total: occurrences.length, occurrences });
      return true;
    }

    if (req.method === "GET" && /^\/v1\/patterns\/[^/]+\/evolution$/.test(url.pathname)) {
      const patternId = decodeURIComponent(url.pathname.split("/")[3]);
      const userId = readQuery(url, "userId");
      if (!userId) {
        json(res, 400, { ok: false, error: "userId is required" });
        return true;
      }
      const evolution = await engine.getEvolution(userId, patternId);
      json(res, 200, { ok: true, userId, patternId, total: evolution.length, evolution });
      return true;
    }

    if (req.method === "GET" && /^\/v1\/reports\/(weekly|monthly|quarterly)$/.test(url.pathname)) {
      const period = url.pathname.split("/").pop();
      const userId = readQuery(url, "userId");
      if (!userId) {
        json(res, 400, { ok: false, error: "userId is required" });
        return true;
      }
      const report = await engine.buildReport(userId, period);
      json(res, 200, report);
      return true;
    }

    if (req.method === "GET" && url.pathname === "/v1/occurrences") {
      const userId = readQuery(url, "userId");
      if (!userId) {
        json(res, 400, { ok: false, error: "userId is required" });
        return true;
      }
      const patternId = readQuery(url, "patternId") || null;
      const occurrences = await engine.getOccurrences(userId, patternId);
      json(res, 200, { ok: true, userId, patternId, total: occurrences.length, occurrences });
      return true;
    }

    return false;
  };
}
