import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { schema } from "./schema";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "..", ".data");

mkdirSync(dataDir, { recursive: true });

export const pglite = new PGlite({
  dataDir: join(dataDir, "postgres"),
});

export const db = drizzle(pglite, { schema });
