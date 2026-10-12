/** Reject stale-tab requests before they can act on another workspace. */
export function validateWorkspace(
  endpoint,
  expectedWorkspace,
  cookieWorkspace,
) {
  if (
    [
      "auth/login",
      "auth/logout",
      "auth/google",
      "me",
      "session/workspace",
    ].includes(endpoint)
  )
    return null;
  if (!cookieWorkspace) return null; // The API performs authentication and returns 401.
  if (!expectedWorkspace || expectedWorkspace !== cookieWorkspace) {
    return {
      code: "workspace_mismatch",
      message:
        "La empresa activa ha cambiado. Actualiza el espacio antes de continuar.",
    };
  }
  return null;
}

/** Browser-controlled Origin must match the public host (or configured origin). */
export function validateOrigin(origin, host, configuredOrigin) {
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    if (
      !["http:", "https:"].includes(parsed.protocol) ||
      parsed.origin !== origin
    )
      return false;
    if (configuredOrigin)
      return parsed.origin === new URL(configuredOrigin).origin;
    return parsed.host === host;
  } catch {
    return false;
  }
}
