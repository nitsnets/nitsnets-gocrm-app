import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { challengeFor } from "../lib/google-auth.mjs";
const enabled = process.env.CRM_GOOGLE_ROUTE_TESTS === "true";
test(
  "real Next Google routes: PKCE/state, HttpOnly cookies, callback and rejection paths",
  { skip: !enabled, timeout: 45000 },
  async () => {
    let starts = 0,
      exchanges = 0;
    const challenges = new Map();
    let child;
    const upstream = createServer(async (req, res) => {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = chunks.length
        ? JSON.parse(Buffer.concat(chunks).toString())
        : {};
      res.setHeader("Content-Type", "application/json");
      if (req.url === "/api/v1/auth/google/start" && req.method === "POST") {
        assert.equal(body.client, "web");
        assert.match(body.code_challenge, /^[A-Za-z0-9_-]{43}$/);
        const state = `controlled-state-${++starts}`;
        challenges.set(state, body.code_challenge);
        res.end(
          JSON.stringify({
            data: {
              state,
              authorization_url: `https://accounts.google.com/o/oauth2/v2/auth?state=${state}`,
            },
          }),
        );
      } else if (
        req.url === "/api/v1/auth/google/exchange" &&
        req.method === "POST"
      ) {
        exchanges++;
        assert.equal(body.code, "single-use-handoff");
        assert.ok(
          [...challenges.values()].includes(challengeFor(body.code_verifier)),
        );
        res.end(
          JSON.stringify({
            data: {
              token: "test-bearer-must-never-reach-browser-js",
              user: {
                id: "user-1",
                name: "Test user",
                email: "test@example.test",
              },
              workspace: { id: "workspace-1", name: "Test workspace" },
              workspaces: [{ id: "workspace-1", name: "Test workspace" }],
            },
          }),
        );
      } else {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: { code: "unexpected_upstream" } }));
      }
    });
    await new Promise((resolve) => upstream.listen(0, "127.0.0.1", resolve));
    const port = Number(process.env.CRM_GOOGLE_ROUTE_TEST_PORT || 3103);
    const origin = `http://127.0.0.1:${port}`;
    let output = "";
    try {
      child = spawn(
        process.execPath,
        [
          "node_modules/next/dist/bin/next",
          "start",
          "--hostname",
          "127.0.0.1",
          "--port",
          String(port),
        ],
        {
          cwd: process.cwd(),
          env: {
            ...process.env,
            CRM_API_URL: `http://127.0.0.1:${upstream.address().port}/api/v1`,
            CRM_WEB_ORIGIN: origin,
            CRM_COOKIE_SECURE: "false",
          },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      child.stdout.on("data", (chunk) => {
        output += chunk;
      });
      child.stderr.on("data", (chunk) => {
        output += chunk;
      });
      let ready = false;
      for (let i = 0; i < 80; i++) {
        if (child.exitCode !== null) throw new Error(output);
        try {
          const response = await fetch(origin);
          if (response.ok) {
            ready = true;
            break;
          }
        } catch {}
        await delay(100);
      }
      assert.ok(ready, `Next did not start: ${output}`);
      const request = (path, options = {}) =>
        fetch(origin + path, { redirect: "manual", ...options });
      async function start() {
        const response = await request("/api/auth/google/start", {
          method: "POST",
          headers: { Origin: origin },
        });
        assert.equal(response.status, 303);
        const target = new URL(response.headers.get("location"));
        assert.equal(target.hostname, "accounts.google.com");
        const entries = response.headers.getSetCookie();
        assert.equal(entries.length, 2);
        for (const entry of entries) {
          assert.match(entry, /HttpOnly/i);
          assert.match(entry, /SameSite=lax/i);
          assert.match(entry, /Max-Age=600/i);
          assert.match(entry, /Path=\/api\/auth\/google/);
        }
        const cookies = entries.map((value) => value.split(";")[0]).join("; ");
        assert.doesNotMatch(await response.text(), /test-bearer|code_verifier/);
        return { cookies, state: target.searchParams.get("state") };
      }
      const attack = await request("/api/auth/google/start", {
        method: "POST",
        headers: { Origin: "https://attacker.test" },
      });
      assert.equal(attack.status, 403);
      assert.equal(starts, 0);
      const forbiddenExchange = await request(
        "/api/backend/auth/google/exchange",
        {
          method: "POST",
          headers: { Origin: origin, "Content-Type": "application/json" },
          body: JSON.stringify({ code: "anything", code_verifier: "known" }),
        },
      );
      assert.equal(forbiddenExchange.status, 404);
      assert.equal(exchanges, 0);
      const first = await start();
      const invalid = await request(
        "/api/auth/google/callback?code=anything&state=wrong",
        { headers: { Cookie: first.cookies } },
      );
      assert.equal(invalid.status, 303);
      assert.equal(
        new URL(invalid.headers.get("location")).searchParams.get(
          "login_error",
        ),
        "invalid_state",
      );
      assert.equal(exchanges, 0);
      assert.ok(
        invalid.headers
          .getSetCookie()
          .every(
            (entry) =>
              entry.includes("Max-Age=0") &&
              entry.includes("Path=/api/auth/google"),
          ),
      );
      const second = await start();
      const success = await request(
        `/api/auth/google/callback?code=single-use-handoff&state=${second.state}`,
        { headers: { Cookie: second.cookies } },
      );
      assert.equal(success.status, 303);
      assert.equal(
        success.headers.get("location"),
        `${origin}/?view=dashboard`,
      );
      assert.equal(exchanges, 1);
      const saved = success.headers.getSetCookie();
      const sessionCookies = saved.filter(
        (c) => c.startsWith("crm_session=") || c.startsWith("crm_workspace="),
      );
      assert.equal(sessionCookies.length, 2);
      for (const entry of sessionCookies) {
        assert.match(entry, /HttpOnly/i);
        assert.match(entry, /SameSite=strict/i);
        assert.match(entry, /Path=\//);
      }
      const removed = saved.filter((c) => c.startsWith("crm_google_"));
      assert.equal(removed.length, 2);
      assert.ok(
        removed.every(
          (c) => c.includes("Max-Age=0") && c.includes("Path=/api/auth/google"),
        ),
      );
      assert.doesNotMatch(success.headers.get("location"), /token|bearer/);
      assert.equal(await success.text(), "");
      const third = await start();
      const denied = await request(
        `/api/auth/google/callback?error=access_denied&state=${third.state}`,
        { headers: { Cookie: third.cookies } },
      );
      assert.equal(
        new URL(denied.headers.get("location")).searchParams.get("login_error"),
        "access_denied",
      );
      assert.equal(exchanges, 1);
    } finally {
      if (child) {
        child.kill("SIGTERM");
        await new Promise((resolve) => child.once("close", resolve));
      }
      await new Promise((resolve) => upstream.close(resolve));
    }
  },
);
