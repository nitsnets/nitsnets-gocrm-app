import test from "node:test";
import assert from "node:assert/strict";
import { readRoute, routeHref, parentRoute } from "../lib/record-route.ts";

test("detail deep links round-trip list search, filters and pagination", () => {
  const list = readRoute("/contacts", "?q=Garc%C3%ADa&page=3&status=active");
  const detail = { ...list, id: "contact-123", mode: "detail" };
  const url = new URL(routeHref(detail), "http://crm.local");
  const restored = readRoute(url.pathname, url.search);
  assert.equal(restored.id, "contact-123");
  assert.equal(restored.mode, "detail");
  assert.equal(
    parentRoute(restored),
    "/contacts?q=Garc%C3%ADa&page=3&status=active",
  );
});
test("edit and relationship pages return to their record, new returns to list", () => {
  assert.equal(
    parentRoute(readRoute("/contacts/123/edit", "?q=Ana")),
    "/contacts/123?q=Ana",
  );
  assert.equal(
    parentRoute(readRoute("/contacts/123/affiliations/new")),
    "/contacts/123",
  );
  assert.equal(parentRoute(readRoute("/quotes/new")), "/quotes");
});
test("mail opened from a contact returns to that contact and mail tab", () => {
  assert.equal(
    parentRoute(readRoute("/messages/m-1", "?contact=c-1")),
    "/contacts/c-1?tab=messages",
  );
});
test("legacy bookmarks remain valid and record routes reject unsupported actions", () => {
  assert.equal(readRoute("/", "?view=settings").view, "settings");
  for (const path of [
    "/messages/new",
    "/messages/123/edit",
    "/settings/123",
    "/unknown",
    "/contacts/a%2Fb",
    "/quotes/123/affiliations/new",
    "/contacts/123/delete",
  ])
    assert.equal(readRoute(path).valid, false, path);
  assert.equal(readRoute("/contacts", "?page=-1").page, 1);
  assert.equal(readRoute("/contacts", "?page=NaN").page, 1);
});
test("record navigation never carries message origin into normal list return", () => {
  assert.equal(
    parentRoute(readRoute("/companies/c-1", "?tab=messages")),
    "/companies",
  );
  assert.equal(
    readRoute("/messages/m-1", "?contact=https://example.com").contact,
    undefined,
  );
});
