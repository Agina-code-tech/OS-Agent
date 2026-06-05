import http from "node:http";
import { URL } from "node:url";
import { createPatternRoutes } from "./routes.js";

export function createPatternServer({ engine, stores, port }) {
  const handleRoute = createPatternRoutes(engine, stores);

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
      const handled = await handleRoute(req, res, url);
      if (!handled) {
        res.statusCode = 404;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ ok: false, error: "Not found" }));
      }
    } catch (error) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : "Internal server error",
      }));
    }
  });

  return {
    server,
    listen() {
      return new Promise((resolve) => {
        server.listen(port, () => resolve(server));
      });
    },
    close() {
      return new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}
