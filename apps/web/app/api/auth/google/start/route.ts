import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  createVerifier,
  challengeFor,
  isGoogleAuthorizationUrl,
} from "@/lib/google-auth.mjs";
import { apiBase, secureCookies, clearGoogleAttempt } from "@/lib/server-auth";
import { validateOrigin } from "@/lib/route-security.mjs";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  if (
    !validateOrigin(
      request.headers.get("origin"),
      request.headers.get("host"),
      process.env.CRM_WEB_ORIGIN,
    )
  )
    return NextResponse.json(
      { error: { code: "invalid_origin", message: "Origen no autorizado" } },
      { status: 403 },
    );
  const publicBase =
    process.env.CRM_WEB_ORIGIN || request.headers.get("origin")!;
  try {
    const verifier = createVerifier();
    const response = await fetch(`${apiBase()}/auth/google/start`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client: "web",
        code_challenge: challengeFor(verifier),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
      redirect: "error",
    });
    const result = await response.json();
    if (
      !response.ok ||
      !result.data?.state ||
      !isGoogleAuthorizationUrl(result.data.authorization_url)
    )
      throw new Error("Google authorization unavailable");
    const jar = await cookies();
    const options = {
      httpOnly: true,
      secure: secureCookies(),
      sameSite: "lax" as const,
      path: "/api/auth/google",
      maxAge: 600,
    };
    jar.set("crm_google_verifier", verifier, options);
    jar.set("crm_google_state", result.data.state, options);
    return NextResponse.redirect(result.data.authorization_url, 303);
  } catch {
    await clearGoogleAttempt();
    return NextResponse.redirect(
      new URL("/?login_error=provider_error", publicBase),
      303,
    );
  }
}
