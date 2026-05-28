import { createServer as createHttpServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer } from "vite";
import { createGuideForDate } from "./src/server/guide-service.js";
import { readJsonBody, sendJson } from "./src/server/http.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const port = Number(process.env.PORT || 5173);

const vite = await createViteServer({
  server: { middlewareMode: true },
  appType: "custom",
});

vite.middlewares.use("/api/generate", async (req, res, next) => {
  if (req.method !== "POST") {
    next();
    return;
  }

  try {
    const body = await readJsonBody(req);
    const result = await createGuideForDate(body?.date);
    sendJson(res, 200, result);
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to generate guide.",
    });
  }
});

vite.middlewares.use(async (req, res, next) => {
  if (!req.url || req.url.startsWith("/api")) {
    next();
    return;
  }

  try {
    const template = await readFile(path.resolve(__dirname, "index.html"), "utf8");
    const html = await vite.transformIndexHtml(req.url, template);
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(html);
  } catch (error) {
    next(error);
  }
});

createHttpServer(vite.middlewares).listen(port, () => {
  console.log(`Daily Astrology OS is running at http://localhost:${port}`);
});
