import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { initDatabase } from "./db/init";
import { seedDatabase } from "./db/seed";
import { appRouter } from "./trpc/router";

const app = new Hono();

app.use("/*", cors({ origin: "*" }));

app.get("/health", (c) => c.json({ ok: true }));

app.all("/trpc/*", (c) =>
  fetchRequestHandler({
    endpoint: "/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext: () => ({}),
  })
);

async function main() {
  await initDatabase();
  await seedDatabase();

  const port = Number(process.env.PORT ?? 3001);
  serve(
    {
      fetch: app.fetch,
      port,
    },
    (info) => {
      console.log(`DueDateHQ server listening on http://localhost:${info.port}`);
    }
  );
}

void main();
