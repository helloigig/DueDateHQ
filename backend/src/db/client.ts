import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env.js";
import * as schema from "./schema.js";

const client = postgres(env.DATABASE_URL, {
  prepare: false,
  max: 10,
  idle_timeout: 20,
  // Supabase requires SSL. postgres-js doesn't always auto-enable it for the
  // pooler hostname, so set explicitly. psql does the same via sslmode=prefer.
  ssl: "require",
});

export const db = drizzle(client, { schema, casing: "snake_case" });
export type DB = typeof db;
