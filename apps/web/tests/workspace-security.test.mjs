import test from "node:test";
import assert from "node:assert/strict";
import { validateWorkspace, validateOrigin } from "../lib/route-security.mjs";
test("a stale tab cannot create a contact in the newly selected workspace", () => {
  assert.equal(
    validateWorkspace("contacts", "old-workspace", "new-workspace").code,
    "workspace_mismatch",
  );
});
test("domain requests must explicitly identify their visible workspace", () => {
  assert.equal(
    validateWorkspace("notes", null, "new-workspace").code,
    "workspace_mismatch",
  );
});
test("a current tab can request its own workspace", () => {
  assert.equal(validateWorkspace("messages/123", "current", "current"), null);
});
test("session discovery remains possible after another tab switches workspace", () => {
  assert.equal(validateWorkspace("me", "old", "new"), null);
});

test("local browser origin matches the public Host even if Next normalizes its internal URL", () => {
  assert.equal(validateOrigin("http://127.0.0.1:3000", "127.0.0.1:3000"), true);
  assert.equal(
    validateOrigin("http://localhost:3000", "127.0.0.1:3000"),
    false,
  );
});
test("cross-origin, opaque and malformed requests cannot mutate", () => {
  for (const origin of ["https://attacker.example", "null", "not a URL", null])
    assert.equal(validateOrigin(origin, "crm.example.com"), false);
});
test("configured production origin pins scheme and host", () => {
  assert.equal(
    validateOrigin(
      "https://crm.example.com",
      "internal:3000",
      "https://crm.example.com",
    ),
    true,
  );
  assert.equal(
    validateOrigin(
      "http://crm.example.com",
      "crm.example.com",
      "https://crm.example.com",
    ),
    false,
  );
});
