import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * Serves the same /api handlers locally that Vercel runs in production,
 * so `npm run dev` is fully working with no extra server.
 */
function jarvisApi(): Plugin {
  const routes: Record<string, { module: string; fn: string }> = {
    "/api/chat": { module: "/server/chatHandler.ts", fn: "handleChat" },
    "/api/tts": { module: "/server/ttsHandler.ts", fn: "handleTts" },
    "/api/config": { module: "/server/ttsHandler.ts", fn: "handleConfig" },
  };
  return {
    name: "jarvis-api",
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const path = (req.url || "").split("?")[0];
        const route = routes[path];
        if (!route) return next();
        try {
          const chunks: Buffer[] = [];
          for await (const c of req) chunks.push(c as Buffer);
          const body = chunks.length ? Buffer.concat(chunks) : undefined;
          const headers = new Headers();
          for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
          const request = new Request(`http://localhost${req.url}`, {
            method: req.method,
            headers,
            body: req.method === "GET" || req.method === "HEAD" ? undefined : body,
          });
          const mod = await server.ssrLoadModule(route.module);
          const response: Response = await mod[route.fn](request);
          res.statusCode = response.status;
          response.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (e) {
          console.error(e);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: "DEV_SERVER_ERROR" }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Make server-only secrets from .env available to the dev API handlers (never to the browser bundle).
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""));
  return { plugins: [react(), jarvisApi()] };
});
