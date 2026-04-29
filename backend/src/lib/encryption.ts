/**
 * Token encryption at rest. AES-256-GCM with a key derived from the
 * `TOKEN_ENCRYPTION_KEY` env var (32-byte hex). Real production should
 * derive this from a KMS / Supabase Vault — a fixed env-var key is
 * encryption-against-disk-leak only, not against compromised secrets.
 *
 * Output format: <iv-hex>:<ciphertext-hex>:<auth-tag-hex>. Easy to grep
 * for, easy to migrate.
 *
 * If the key is missing, encrypt is a passthrough (returns the plaintext
 * with a "plaintext:" prefix). This lets local development run without
 * touching the env, while production refuses to start without the key
 * (see backend/src/env.ts validation hook — TODO).
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const PASSTHROUGH_PREFIX = "plaintext:";
const ALGO = "aes-256-gcm";

function getKey(): Buffer | null {
  const hex = process.env.TOKEN_ENCRYPTION_KEY;
  if (!hex) return null;
  if (hex.length !== 64) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY must be a 32-byte (64 hex char) string",
    );
  }
  return Buffer.from(hex, "hex");
}

export function encryptToken(plaintext: string): string {
  if (!plaintext) return plaintext;
  const key = getKey();
  if (!key) return PASSTHROUGH_PREFIX + plaintext;

  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${encrypted.toString("hex")}:${tag.toString("hex")}`;
}

export function decryptToken(stored: string | null): string | null {
  if (!stored) return null;
  if (stored.startsWith(PASSTHROUGH_PREFIX)) {
    return stored.slice(PASSTHROUGH_PREFIX.length);
  }
  const key = getKey();
  if (!key) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY missing but stored value is encrypted",
    );
  }
  const parts = stored.split(":");
  if (parts.length !== 3) {
    throw new Error("malformed_encrypted_token");
  }
  const [ivHex, ctHex, tagHex] = parts;
  const decipher = createDecipheriv(
    ALGO,
    key,
    Buffer.from(ivHex!, "hex"),
  );
  decipher.setAuthTag(Buffer.from(tagHex!, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(ctHex!, "hex")),
    decipher.final(),
  ]).toString("utf8");
}
