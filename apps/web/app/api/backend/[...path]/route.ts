import { validateWorkspace, validateOrigin } from "@/lib/route-security.mjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
const tokenCookie = "crm_session";
const workspaceCookie = "crm_workspace";
async function proxy(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  if (path.some((segment) => !/^[a-zA-Z0-9_-]+$/.test(segment)))
    return NextResponse.json(
      { error: { message: "Ruta no válida" } },
      { status: 400 },
    );
  if (!["GET", "HEAD"].includes(request.method)) {
    const origin = request.headers.get("origin");
    if (
      !validateOrigin(
        origin,
        request.headers.get("host"),
        process.env.CRM_WEB_ORIGIN,
      )
    )
      return NextResponse.json(
        { error: { message: "Origen no autorizado" } },
        { status: 403 },
      );
  }
  const jar = await cookies();
  const headers = new Headers({
    Accept: "application/json",
    "Content-Type": "application/json",
  });
  const token = jar.get(tokenCookie)?.value;
  const workspace = jar.get(workspaceCookie)?.value;
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const endpoint = path.join("/");
  // OAuth handoff is server-only; never let the generic JSON proxy expose tokens.
  if (endpoint.startsWith("auth/google/"))
    return NextResponse.json(
      {
        error: {
          code: "route_not_available",
          message: "Usa el acceso con Google desde la pantalla de entrada.",
        },
      },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  const expectedWorkspace = request.headers.get("X-Workspace-ID");
  const workspaceError = validateWorkspace(
    endpoint,
    expectedWorkspace,
    workspace,
  );
  if (workspaceError)
    return NextResponse.json(
      { error: workspaceError },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  if (expectedWorkspace) headers.set("X-Workspace-ID", expectedWorkspace);
  const base = (
    process.env.CRM_API_URL || "http://127.0.0.1:8000/api/v1"
  ).replace(/\/$/, "");
  try {
    const response = await fetch(
      `${base}/${endpoint}${request.nextUrl.search}`,
      {
        method: request.method,
        headers,
        body: ["GET", "HEAD"].includes(request.method)
          ? undefined
          : await request.text(),
        cache: "no-store",
        signal: AbortSignal.timeout(30000),
        redirect: "error",
      },
    );
    const body = response.status === 204 ? null : await response.json();
    const cookieOptions = {
      httpOnly: true,
      secure:
        process.env.CRM_COOKIE_SECURE === "true" ||
        (process.env.CRM_COOKIE_SECURE !== "false" &&
          process.env.NODE_ENV === "production"),
      sameSite: "strict" as const,
      path: "/",
    };
    if (response.ok && endpoint === "auth/login") {
      jar.set(tokenCookie, body.data.token, cookieOptions);
      jar.set(workspaceCookie, body.data.workspace.id, cookieOptions);
      delete body.data.token;
    }
    if (response.ok && endpoint === "session/workspace")
      jar.set(workspaceCookie, body.data.workspace.id, cookieOptions);
    if (
      (response.ok && endpoint === "auth/logout") ||
      response.status === 401
    ) {
      jar.delete(tokenCookie);
      jar.delete(workspaceCookie);
    }
    return new NextResponse(body === null ? null : JSON.stringify(body), {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "upstream_unavailable",
          message:
            "No se ha podido conectar con el servidor. Vuelve a intentarlo en unos instantes.",
        },
      },
      { status: 502 },
    );
  }
}
export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
