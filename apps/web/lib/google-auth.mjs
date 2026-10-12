import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
export function createVerifier() {
  return randomBytes(32).toString("base64url");
}
export function challengeFor(verifier) {
  return createHash("sha256").update(verifier).digest("base64url");
}
export function statesMatch(expected, received) {
  if (
    typeof expected !== "string" ||
    typeof received !== "string" ||
    !expected ||
    !received
  )
    return false;
  const a = Buffer.from(expected),
    b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function isGoogleAuthorizationUrl(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "accounts.google.com" &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}
