import test from "node:test";
import assert from "node:assert/strict";
const base = process.env.CRM_WEB_TEST_URL;
test(
  "real BFF login, CRUD, server totals, CSRF, stale workspace and logout",
  { skip: !base },
  async () => {
    let cookie = "";
    let workspace = "";
    const cleanup = [];
    async function request(path, method = "GET", body, extra = {}) {
      const response = await fetch(`${base}/api/backend/${path}`, {
        method,
        headers: {
          Origin: base,
          "Content-Type": "application/json",
          ...(cookie ? { Cookie: cookie } : {}),
          ...(workspace ? { "X-Workspace-ID": workspace } : {}),
          ...extra,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const newCookies = response.headers.getSetCookie();
      if (newCookies.length)
        cookie = newCookies.map((v) => v.split(";")[0]).join("; ");
      const payload = response.status === 204 ? null : await response.json();
      return { response, payload };
    }
    const login = await request("auth/login", "POST", {
      email: process.env.CRM_WEB_TEST_EMAIL || "eladio@nitsnets.demo",
      password: process.env.CRM_WEB_TEST_PASSWORD || "DemoCRM!2026",
    });
    assert.equal(login.response.status, 200);
    assert.equal(login.payload.data.token, undefined);
    assert.ok(
      login.response.headers
        .getSetCookie()
        .every((c) => c.includes("HttpOnly")),
    );
    workspace = login.payload.data.workspace.id;
    try {
      for (const path of [
        "dashboard",
        "contacts",
        "companies",
        "messages",
        "tasks",
        "quotes",
        "events",
        "integrations/gmail",
      ])
        assert.equal((await request(path)).response.status, 200, path);
      const create = await request("contacts", "POST", {
        first_name: "Verificación",
        last_name: "Web BFF",
        email: `web-check-${Date.now()}@example.test`,
      });
      assert.equal(create.response.status, 201);
      cleanup.push(`contacts/${create.payload.data.id}`);
      const update = await request(
        `contacts/${create.payload.data.id}`,
        "PATCH",
        { job_title: "Integración validada" },
      );
      assert.equal(update.payload.data.job_title, "Integración validada");
      const quote = await request("quotes", "POST", {
        title: "Verificación de cálculo BFF",
        currency: "EUR",
        items: [
          {
            description: "Partida decimal",
            quantity: 1.25,
            unit_price_minor: 101,
          },
        ],
      });
      assert.equal(quote.response.status, 201);
      cleanup.push(`quotes/${quote.payload.data.id}`);
      assert.equal(quote.payload.data.total_minor, 126);
      const editQuote = await request(
        `quotes/${quote.payload.data.id}`,
        "PATCH",
        {
          items: [
            {
              description: "Partida editada",
              quantity: 2.5,
              unit_price_minor: 101,
            },
          ],
        },
      );
      assert.equal(editQuote.payload.data.total_minor, 253);
      const before = (await request("contacts")).payload.meta.total;
      const stale = await request(
        "contacts",
        "POST",
        { first_name: "No debe crearse" },
        { "X-Workspace-ID": "old-workspace" },
      );
      assert.equal(stale.response.status, 409);
      assert.equal(stale.payload.error.code, "workspace_mismatch");
      assert.equal((await request("contacts")).payload.meta.total, before);
      const csrf = await request(
        "contacts",
        "POST",
        { first_name: "No debe crearse" },
        { Origin: "https://another.example" },
      );
      assert.equal(csrf.response.status, 403);
    } finally {
      for (const path of cleanup.reverse())
        assert.equal((await request(path, "DELETE")).response.status, 204);
      await request("auth/logout", "POST");
    }
    assert.equal((await request("me")).response.status, 401);
  },
);
