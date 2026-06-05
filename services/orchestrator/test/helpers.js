export function createMockClient(responses = {}) {
  return {
    get: async (path, options = {}) => {
      const handler = responses.get?.[path];
      if (typeof handler === "function") return handler(options);
      if (handler !== undefined) return handler;
      return { ok: true, payload: { path, options } };
    },
    post: async (path, body, options = {}) => {
      const handler = responses.post?.[path];
      if (typeof handler === "function") return handler(body, options);
      if (handler !== undefined) return handler;
      return { ok: true, payload: { path, body, options } };
    },
  };
}

