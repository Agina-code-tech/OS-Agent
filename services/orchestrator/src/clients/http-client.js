function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function appendSearchParams(url, searchParams) {
  if (!searchParams) return;
  if (searchParams instanceof URLSearchParams) {
    for (const [key, value] of searchParams.entries()) {
      url.searchParams.append(key, value);
    }
    return;
  }

  if (Array.isArray(searchParams)) {
    for (const entry of searchParams) {
      if (!Array.isArray(entry) || entry.length < 2) continue;
      url.searchParams.append(String(entry[0]), String(entry[1]));
    }
    return;
  }

  for (const [key, value] of Object.entries(searchParams)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        url.searchParams.append(key, String(item));
      }
      continue;
    }
    url.searchParams.append(key, String(value));
  }
}

async function parseJsonResponse(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: text };
  }
}

export class HttpServiceClient {
  constructor({ name, baseUrl, timeoutMs = 10000, retries = 1, fetchImpl = globalThis.fetch } = {}) {
    this.name = name;
    this.baseUrl = String(baseUrl || "").replace(/\/+$/, "");
    this.timeoutMs = timeoutMs;
    this.retries = retries;
    this.fetchImpl = fetchImpl;
  }

  get enabled() {
    return Boolean(this.baseUrl);
  }

  async request(path, { method = "GET", body, headers = {}, searchParams = null } = {}) {
    if (!this.enabled) {
      return { ok: false, skipped: true, service: this.name, error: "service disabled" };
    }

    const baseUrl = new URL(`${this.baseUrl}${path}`);
    let attempt = 0;
    let lastError = null;

    while (attempt <= this.retries) {
      const url = new URL(baseUrl.toString());
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        appendSearchParams(url, searchParams);
        const requestHeaders = { ...headers };
        if (body !== undefined && !requestHeaders["Content-Type"]) {
          requestHeaders["Content-Type"] = "application/json";
        }
        const response = await this.fetchImpl(url, {
          method,
          headers: requestHeaders,
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: controller.signal,
        });
        const payload = await parseJsonResponse(response);
        if (!response.ok) {
          const message = payload?.error || `Request failed with status ${response.status}`;
          return { ok: false, service: this.name, status: response.status, error: message, payload };
        }
        return { ok: true, service: this.name, status: response.status, payload };
      } catch (error) {
        lastError = error;
        attempt += 1;
        if (attempt > this.retries) break;
        await sleep(100 * attempt);
      } finally {
        clearTimeout(timeout);
      }
    }

    return {
      ok: false,
      service: this.name,
      error: lastError instanceof Error ? lastError.message : "Request failed",
    };
  }

  async get(path, options = {}) {
    return this.request(path, { ...options, method: "GET" });
  }

  async post(path, body, options = {}) {
    return this.request(path, { ...options, method: "POST", body });
  }
}

export function buildServiceClients(config = {}, fetchImpl = globalThis.fetch) {
  return {
    memory: new HttpServiceClient({
      name: "memory",
      baseUrl: config.memoryGraphUrl,
      timeoutMs: config.timeoutMs,
      retries: config.retries,
      fetchImpl,
    }),
    pattern: new HttpServiceClient({
      name: "pattern",
      baseUrl: config.patternServiceUrl,
      timeoutMs: config.timeoutMs,
      retries: config.retries,
      fetchImpl,
    }),
    narrative: new HttpServiceClient({
      name: "narrative",
      baseUrl: config.narrativeServiceUrl,
      timeoutMs: config.timeoutMs,
      retries: config.retries,
      fetchImpl,
    }),
    research: new HttpServiceClient({
      name: "research",
      baseUrl: config.researchRagUrl,
      timeoutMs: config.timeoutMs,
      retries: config.retries,
      fetchImpl,
    }),
  };
}
