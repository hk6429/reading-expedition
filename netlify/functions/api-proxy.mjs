export default async (request, context) => {
  const origin = Netlify.env.get("READING_API_ORIGIN");
  if (!origin) {
    return Response.json(
      { error: { code: "api_not_configured", message: "API 尚未設定。" } },
      { status: 503 },
    );
  }
  const incoming = new URL(request.url);
  const path = context.params.splat ?? "";
  const target = new URL(`/api/${path}${incoming.search}`, origin);
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("x-forwarded-host");
  return fetch(target, {
    method: request.method,
    headers,
    body: ["GET", "HEAD"].includes(request.method) ? null : request.body,
    redirect: "manual",
  });
};
