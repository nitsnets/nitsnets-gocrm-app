import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { statesMatch } from "@/lib/google-auth.mjs";
import {
  apiBase,
  clearGoogleAttempt,
  establishSession,
} from "@/lib/server-auth";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  // Public origin is configuration, or the browser's actual Host in local development.
  const base =
    process.env.CRM_WEB_ORIGIN ||
    `${request.nextUrl.protocol}//${request.headers.get("host")}`;
  const jar = await cookies();
  const verifier = jar.get("crm_google_verifier")?.value;
  const expected = jar.get("crm_google_state")?.value;
  const state = request.nextUrl.searchParams.get("state");
  const fail = async (code: string) => {
    await clearGoogleAttempt();
    return NextResponse.redirect(new URL(`/?login_error=${code}`, base), 303);
  };
  if (!verifier || !statesMatch(expected, state)) return fail("invalid_state");
  const providerError = request.nextUrl.searchParams.get("error");
  if (providerError)
    return fail(
      ["access_denied", "not_allowed"].includes(providerError)
        ? providerError
        : "provider_error",
    );
  const code = request.nextUrl.searchParams.get("code");
  if (!code) return fail("provider_error");
  try {
    const response = await fetch(`${apiBase()}/auth/google/exchange`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code, code_verifier: verifier }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
      redirect: "error",
    });
    const result = await response.json();
    if (
      !response.ok ||
      typeof result.data?.token !== "string" ||
      !result.data.workspace?.id
    )
      return fail(response.status === 403 ? "not_allowed" : "provider_error");
    await establishSession(result.data.token, result.data.workspace.id);
    await clearGoogleAttempt();
    return NextResponse.redirect(new URL("/?view=dashboard", base), 303);
  } catch {
    return fail("provider_error");
  }
}
