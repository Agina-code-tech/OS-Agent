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
    content: body.content ?? body.text ?? body.body ?? "",
    title: body.title ?? body.name ?? "Untitled source",
    abstract: body.abstract ?? "",
    publicationType: body.publicationType ?? body.publication_type ?? "peer_reviewed_research_paper",
    publicationYear: body.publicationYear ?? body.publication_year ?? null,
    sourceUrl: body.sourceUrl ?? body.url ?? null,
    tags: body.tags && Array.isArray(body.tags) ? body.tags : [],
    frameworks: body.frameworks && Array.isArray(body.frameworks) ? body.frameworks : [],
    domains: body.domains && Array.isArray(body.domains) ? body.domains : [],
    authors: body.authors && Array.isArray(body.authors) ? body.authors : [],
  };
}

export function createResearchRoutes(engine, stores) {
  return async function handleRoute(req, res, url) {
    if (req.method === "GET" && url.pathname === "/healthz") {
      const storeHealth = await engine.health();
      json(res, 200, {
        ok: true,
        service: "research-rag-engine",
        store: storeHealth,
      });
      return true;
    }

    if (req.method === "POST" && url.pathname === "/v1/documents/ingest") {
      const body = normalizeIngestBody(await readJson(req));
      const result = await engine.ingest(body);
      json(res, 200, result);
      return true;
    }

    if (req.method === "GET" && url.pathname === "/v1/documents") {
      const filters = {
        publicationType: readQuery(url, "publicationType"),
        collection: readQuery(url, "collection"),
        framework: readQuery(url, "framework"),
      };
      const documents = await engine.listDocuments(filters);
      json(res, 200, { ok: true, total: documents.length, documents });
      return true;
    }

    if (req.method === "GET" && /^\/v1\/documents\/[^/]+$/.test(url.pathname)) {
      const documentId = decodeURIComponent(url.pathname.split("/").pop());
      const document = await engine.getDocument(documentId);
      if (!document) {
        json(res, 404, { ok: false, error: "Document not found" });
        return true;
      }
      json(res, 200, { ok: true, document });
      return true;
    }

    if (req.method === "GET" && /^\/v1\/chunks\/[^/]+$/.test(url.pathname)) {
      const chunkId = decodeURIComponent(url.pathname.split("/").pop());
      const chunk = await engine.getChunk(chunkId);
      if (!chunk) {
        json(res, 404, { ok: false, error: "Chunk not found" });
        return true;
      }
      json(res, 200, { ok: true, chunk });
      return true;
    }

    if (req.method === "POST" && url.pathname === "/v1/retrieve") {
      const body = await readJson(req);
      const result = await engine.retrieve(body.query || body.text || "", body);
      json(res, 200, result);
      return true;
    }

    if (req.method === "GET" && url.pathname === "/v1/search") {
      const query = readQuery(url, "q") || "";
      const result = await engine.search(query, {
        publicationType: readQuery(url, "publicationType"),
        collection: readQuery(url, "collection"),
        frameworks: url.searchParams.getAll("framework"),
        topK: readQuery(url, "topK"),
      });
      json(res, 200, result);
      return true;
    }

    if (req.method === "POST" && url.pathname === "/v1/evaluate") {
      const body = await readJson(req);
      const result = await engine.evaluate(body);
      json(res, 200, result);
      return true;
    }

    if (req.method === "GET" && url.pathname === "/v1/retrievals") {
      const retrievals = await stores.research.listRetrievals(readQuery(url, "userId") || "global");
      json(res, 200, { ok: true, total: retrievals.length, retrievals });
      return true;
    }

    if (req.method === "GET" && url.pathname === "/v1/evaluations") {
      const evaluations = await stores.research.listEvaluations();
      json(res, 200, { ok: true, total: evaluations.length, evaluations });
      return true;
    }

    return false;
  };
}
