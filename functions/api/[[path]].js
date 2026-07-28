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
  const target = new URL(`/api/${path.join("/")}${incoming.search}`, origin);
  const headers = new Headers(context.request.headers);
  headers.delete("host");
  return fetch(target, new Request(context.request, { headers }));
}
