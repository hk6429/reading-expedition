export const TEACHER_SESSION_COOKIE = "teacher_session";

export function createSessionCookie(token, maxAgeSeconds) {
  return [
    `${TEACHER_SESSION_COOKIE}=${token}`,
    "Path=/",
    `Max-Age=${maxAgeSeconds}`,
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
  ].join("; ");
}

export function clearSessionCookie() {
  return [
    `${TEACHER_SESSION_COOKIE}=`,
    "Path=/",
    "Max-Age=0",
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
  ].join("; ");
}

export function readSessionToken(request) {
  const cookie = request.headers.get("cookie") ?? "";
  for (const pair of cookie.split(";")) {
    const [name, ...valueParts] = pair.trim().split("=");
    if (name === TEACHER_SESSION_COOKIE) {
      return valueParts.join("=") || null;
    }
  }
  return null;
}
