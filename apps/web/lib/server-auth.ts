import { cookies } from "next/headers";
export function apiBase() {
  return (process.env.CRM_API_URL || "http://127.0.0.1:8000/api/v1").replace(
    /\/$/,
    "",
  );
}
export function secureCookies() {
  return (
    process.env.CRM_COOKIE_SECURE === "true" ||
    (process.env.CRM_COOKIE_SECURE !== "false" &&
      process.env.NODE_ENV === "production")
  );
}
export async function establishSession(token: string, workspaceId: string) {
  const jar = await cookies();
  const options = {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: "strict" as const,
    path: "/",
  };
  jar.set("crm_session", token, options);
  jar.set("crm_workspace", workspaceId, options);
}
export async function clearGoogleAttempt() {
  const jar = await cookies();
  const options = {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: "lax" as const,
    path: "/api/auth/google",
    maxAge: 0,
  };
  jar.set("crm_google_verifier", "", options);
  jar.set("crm_google_state", "", options);
}
