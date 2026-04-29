import { serve } from "@hono/node-server";
import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { env } from "./env.js";
import { createContext } from "./trpc/context.js";
import { appRouter } from "./trpc/_app.js";

const app = new Hono();

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: env.CORS_ORIGIN === "*" ? (origin) => origin ?? "*" : env.CORS_ORIGIN,
    credentials: true,
    allowHeaders: ["Authorization", "Content-Type"],
  }),
);

app.get("/health", (c) =>
  c.json({ ok: true, serverTime: new Date().toISOString() }),
);

app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext: (opts) => createContext(opts),
  }),
);

serve(
  { fetch: app.fetch, port: env.PORT },
  (info) => {
    // eslint-disable-next-line no-console
    console.log(`[ddhq-backend] listening on :${info.port} (${env.NODE_ENV})`);
  },
);

export type { AppRouter } from "./trpc/_app.js";
