export async function onRequest(context) {
  const origin = context.env.READING_API_ORIGIN;
  if (!origin) {
    return Response.json(
      { error: { code: "api_not_configured", message: "API 尚未設定。" } },
      { status: 503 },
    );
  }
  const incoming = new URL(context.request.url);
  const path = context.params.path ?? [];
  const suffix = Array.isArray(path) ? path.join("/") : path;
  const target = new URL(`/api/${suffix}${incoming.search}`, origin);
  const headers = new Headers(context.request.headers);
  headers.delete("host");
  headers.delete("x-forwarded-host");
  headers.set("accept-encoding", "identity");
  return fetch(target, {
    method: context.request.method,
    headers,
    body: ["GET", "HEAD"].includes(context.request.method)
      ? null
      : context.request.body,
    redirect: "manual",
  });
}
