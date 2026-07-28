const PRIVATE_IPV4 = [
  /^0\./,
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^224\./,
  /^255\./,
];

function isPrivateHost(hostname) {
  const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:") ||
    PRIVATE_IPV4.some((pattern) => pattern.test(normalized))
  );
}

export function assertSafeUrl(value, allowedHosts) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError("source URL is invalid");
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new TypeError("source URL scheme is not allowed");
  }
  if (isPrivateHost(url.hostname)) {
    throw new TypeError("source URL resolves to a private host");
  }
  if (!allowedHosts?.has(url.hostname)) {
    throw new TypeError("source host is not allowlisted");
  }
  url.username = "";
  url.password = "";
  url.hash = "";
  return url;
}

async function readBoundedBody(response, maxBytes) {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error("source response is too large");
  }
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("source response is too large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function fetchAllowlisted(
  value,
  {
    allowedHosts,
    fetchImpl = fetch,
    timeoutMs = 8_000,
    maxBytes = 512_000,
    maxRedirects = 3,
  },
) {
  let url = assertSafeUrl(value, allowedHosts);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
      const response = await fetchImpl(url, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          accept: "application/rss+xml, application/xml, application/json, text/xml;q=0.9",
          "user-agent": "ReadingExpedition/1.0 (+educational-source-audit)",
        },
      });
      if (response.status >= 300 && response.status < 400) {
        if (redirectCount === maxRedirects) {
          throw new Error("source redirect limit exceeded");
        }
        const location = response.headers.get("location");
        if (!location) throw new Error("source redirect is missing location");
        url = assertSafeUrl(new URL(location, url).toString(), allowedHosts);
        continue;
      }
      if (!response.ok) {
        const error = new Error(`source responded with HTTP ${response.status}`);
        error.code = "source_http_error";
        throw error;
      }
      const bytes = await readBoundedBody(response, maxBytes);
      return {
        bytes,
        text: new TextDecoder().decode(bytes),
        finalUrl: url.toString(),
        contentType: response.headers.get("content-type") ?? "",
      };
    }
    throw new Error("source redirect limit exceeded");
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error("source request timed out");
      timeoutError.code = "source_timeout";
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
