export default async function handler(request, response) {
  const origin = process.env.READING_API_ORIGIN;
  if (!origin) {
    return response.status(503).json({
      error: { code: "api_not_configured", message: "API 尚未設定。" },
    });
  }
  const pieces = Array.isArray(request.query.path)
    ? request.query.path
    : [request.query.path].filter(Boolean);
  const incoming = new URL(request.url, "https://local.invalid");
  const target = new URL(`/api/${pieces.join("/")}${incoming.search}`, origin);
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (!["host", "x-forwarded-host", "content-length"].includes(key)) {
      headers.set(key, Array.isArray(value) ? value.join(", ") : value);
    }
  }
  headers.set("accept-encoding", "identity");
  const body =
    ["GET", "HEAD"].includes(request.method)
      ? undefined
      : typeof request.body === "string"
        ? request.body
        : JSON.stringify(request.body ?? {});
  const upstream = await fetch(target, {
    method: request.method,
    headers,
    body,
    redirect: "manual",
  });
  response.status(upstream.status);
  for (const [key, value] of upstream.headers) {
    if (!["content-length", "content-encoding"].includes(key)) {
      response.setHeader(key, value);
    }
  }
  return response.send(Buffer.from(await upstream.arrayBuffer()));
}
