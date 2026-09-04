import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Jeton déterministe ajouté aux URLs de callback SwyChr.
 * Il ne peut être calculé qu'avec la clé API serveur : il authentifie le webhook.
 */
export function callbackToken(transactionId: string): string {
  const key = process.env["SWYCHR_API_KEY"] ?? "";
  return createHmac("sha256", key).update(transactionId).digest("hex").slice(0, 32);
}

export function verifyCallbackToken(transactionId: string, token: string | null): boolean {
  if (!token) return false;
  const expected = callbackToken(transactionId);
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
