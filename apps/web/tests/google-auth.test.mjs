import test from "node:test";
import assert from "node:assert/strict";
import {
  createVerifier,
  challengeFor,
  statesMatch,
  isGoogleAuthorizationUrl,
} from "../lib/google-auth.mjs";
test("Google handoff PKCE challenge follows the RFC 7636 S256 example", () => {
  assert.equal(
    challengeFor("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
    "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
  );
});
test("each login attempt has a distinct 256-bit URL-safe verifier", () => {
  const a = createVerifier(),
    b = createVerifier();
  assert.match(a, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(a, b);
});
test("state must match the cookie; missing, changed and oversized values are rejected", () => {
  assert.equal(statesMatch("valid-state", "valid-state"), true);
  for (const state of [null, "", "changed-state", "valid-state-extra"])
    assert.equal(statesMatch("valid-state", state), false);
  assert.equal(statesMatch(null, "valid-state"), false);
});
test("start only redirects to HTTPS Google authorization without userinfo", () => {
  assert.equal(
    isGoogleAuthorizationUrl(
      "https://accounts.google.com/o/oauth2/v2/auth?state=xyz",
    ),
    true,
  );
  for (const url of [
    "http://accounts.google.com",
    "https://accounts.google.com.evil.test",
    "https://user@accounts.google.com",
    "javascript:alert(1)",
    "invalid",
  ])
    assert.equal(isGoogleAuthorizationUrl(url), false);
});
