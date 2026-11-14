import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM encryption for secrets stored in the database (GitHub access
 * tokens).
 *
 * Stored format: `v1:<iv>:<tag>:<ciphertext>`, each part base64url.
 * The key is TOKEN_ENCRYPTION_KEY: 32 random bytes, base64
 * (`openssl rand -base64 32`).
 */

const VERSION = "v1";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;

function getKey(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("TOKEN_ENCRYPTION_KEY is not set");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `TOKEN_ENCRYPTION_KEY must be ${KEY_BYTES} bytes, base64-encoded (openssl rand -base64 32)`,
    );
  }
  return key;
}

export function encrypt(plain: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv, {
    authTagLength: TAG_BYTES,
  });
  const ciphertext = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);
  return [
    VERSION,
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(":");
}

/**
 * Decrypts a value produced by `encrypt`. Values without the `v1:` prefix are
 * legacy plain-text tokens (stored before encryption existed) and are returned
 * unchanged, so old rows keep working until the user's next login re-encrypts
 * them. Throws if the value is malformed or has been tampered with.
 */
export function decrypt(stored: string): string {
  if (!stored.startsWith(`${VERSION}:`)) {
    return stored;
  }

  const parts = stored.split(":");
  if (parts.length !== 4) {
    throw new Error("Malformed encrypted value");
  }
  const [, ivPart, tagPart, ciphertextPart] = parts;
  const iv = Buffer.from(ivPart, "base64url");
  const tag = Buffer.from(tagPart, "base64url");
  const ciphertext = Buffer.from(ciphertextPart, "base64url");
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new Error("Malformed encrypted value");
  }

  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv, {
    authTagLength: TAG_BYTES,
  });
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}
