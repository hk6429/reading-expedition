export const FAMILY_SESSION_COOKIE = "family_session";

export function createFamilySessionCookie(token, maxAgeSeconds) {
  return [
    `${FAMILY_SESSION_COOKIE}=${token}`,
    "Path=/",
    `Max-Age=${maxAgeSeconds}`,
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
  ].join("; ");
}

export function clearFamilySessionCookie() {
  return [
    `${FAMILY_SESSION_COOKIE}=`,
    "Path=/",
    "Max-Age=0",
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
  ].join("; ");
}

export function readFamilySessionToken(request) {
  const cookie = request.headers.get("cookie") ?? "";
  for (const pair of cookie.split(";")) {
    const [name, ...valueParts] = pair.trim().split("=");
    if (name === FAMILY_SESSION_COOKIE) {
      return valueParts.join("=") || null;
    }
  }
  return null;
}
