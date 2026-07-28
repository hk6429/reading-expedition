function resolveApiOrigin() {
  return (
    globalThis.Netlify?.env?.get("READING_API_ORIGIN") ??
    process.env.READING_API_ORIGIN
  );
}

function targetPath(pathname) {
  const functionPrefix = "/.netlify/functions/api";
  if (pathname.startsWith(functionPrefix)) {
    const suffix = pathname.slice(functionPrefix.length);
    return `/api${suffix.startsWith("/") ? suffix : `/${suffix}`}`;
  }
  if (pathname === "/api" || pathname.startsWith("/api/")) return pathname;
  return null;
}

export function createNetlifyApiProxy({
  apiOrigin = resolveApiOrigin(),
  fetchImpl = fetch,
} = {}) {
  let origin;
  try {
    origin = new URL(apiOrigin);
  } catch {
    origin = null;
  }
  if (!origin || origin.protocol !== "https:") {
    return async () =>
      new Response("API proxy is not configured", { status: 503 });
  }

  return async (request) => {
    const incoming = new URL(request.url);
    const pathname = targetPath(incoming.pathname);
    if (!pathname) return new Response("Not found", { status: 404 });

    const target = new URL(pathname, origin);
    target.search = incoming.search;
    const headers = new Headers(request.headers);
    headers.delete("host");
    const response = await fetchImpl(target, {
      method: request.method,
      headers,
      body:
        request.method === "GET" || request.method === "HEAD"
          ? undefined
          : request.body,
      redirect: "manual",
    });
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  };
}

export default createNetlifyApiProxy();
