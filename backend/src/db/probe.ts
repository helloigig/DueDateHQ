/**
 * Connection probe. Reports the parsed URL parts (no password leak) +
 * password character classes + the exact PG error. Use to diagnose auth
 * failures without exposing the password to the terminal.
 *
 *   tsx --env-file-if-exists=.env.local src/db/probe.ts
 */
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

let parsed: URL;
try {
  parsed = new URL(url);
} catch (e) {
  console.error("URL parse failed:", (e as Error).message);
  process.exit(1);
}

const password = decodeURIComponent(parsed.password);
const rawPassword = parsed.password;

console.log("─── Parsed URL (no password) ───");
console.log("protocol:", parsed.protocol);
console.log("username:", parsed.username);
console.log("host:    ", parsed.hostname);
console.log("port:    ", parsed.port);
console.log("database:", parsed.pathname.slice(1));
console.log();
console.log("─── Password analysis (no value echoed) ───");
console.log("raw password length (in URL):    ", rawPassword.length);
console.log("decoded password length:         ", password.length);
console.log("contains uppercase A-Z:          ", /[A-Z]/.test(password));
console.log("contains lowercase a-z:          ", /[a-z]/.test(password));
console.log("contains digits 0-9:             ", /[0-9]/.test(password));
console.log(
  "contains special chars (! @ # $ % ^ & * + - _ ): ",
  /[!@#$%^&*+\-_]/.test(password),
);
console.log(
  "contains URL-special (/ : ? # & = + space):    ",
  /[\/\:\?\#\&\=\+\s]/.test(password),
);
console.log("starts with whitespace:          ", /^\s/.test(password));
console.log("ends with whitespace or newline: ", /\s$/.test(password));
if (rawPassword !== password) {
  console.log("⚠️  raw and decoded differ — password is URL-encoded in source URL");
}

console.log();
console.log("─── Attempting connection ───");
const sql = postgres(url, {
  prepare: false,
  max: 1,
  idle_timeout: 5,
  ssl: "require",
});
try {
  const rows = await sql`SELECT current_user, current_database(), version()`;
  console.log("✓ CONNECTED");
  console.log("server reports current_user =", rows[0]?.current_user);
  console.log("server reports current_database =", rows[0]?.current_database);
  await sql.end();
  process.exit(0);
} catch (e) {
  const err = e as Error & { code?: string; severity?: string };
  console.error("✗ CONNECTION FAILED");
  console.error("error code:    ", err.code ?? "(none)");
  console.error("error severity:", err.severity ?? "(none)");
  console.error("error message: ", err.message);
  console.error();
  if (err.code === "28P01") {
    console.error(
      "→ '28P01' is Postgres's password mismatch code. The password reaching\n" +
      "  the server doesn't match what Supabase has on record.\n" +
      "  Common causes:\n" +
      "  1. Special chars in password not URL-encoded (e.g. '&', '#', '+', '/')\n" +
      "     — see the 'contains URL-special' line above. If true, the URL\n" +
      "     parser may be eating part of the password.\n" +
      "  2. Trailing whitespace/newline accidentally included in the URL.\n" +
      "  3. The password in the URL is for a previous reset; Supabase may have\n" +
      "     issued another since.",
    );
  }
  await sql.end({ timeout: 1 });
  process.exit(1);
}
