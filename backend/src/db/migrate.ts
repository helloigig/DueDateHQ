import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { env } from "../env.js";

const client = postgres(env.DATABASE_URL, {
  prepare: false,
  max: 1,
  ssl: "require",
});
const db = drizzle(client);

await migrate(db, { migrationsFolder: "./migrations" });
await client.end();
// eslint-disable-next-line no-console
console.log("[ddhq-backend] migrations applied");
