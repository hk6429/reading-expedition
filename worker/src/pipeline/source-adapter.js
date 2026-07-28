import { fetchAllowlisted } from "./url-safety.js";

export function createSourceFetcher({
  registry,
  fetchImpl = fetch,
  timeoutMs = 8_000,
  maxBytes = 512_000,
}) {
  return async function fetchSource(source, url) {
    const registered = registry.requireForUrl(url);
    if (registered.id !== source.id) {
      const error = new Error("source identity does not match allowlist");
      error.code = "source_identity_mismatch";
      throw error;
    }
    return fetchAllowlisted(url, {
      allowedHosts: registry.allowedHosts,
      fetchImpl,
      timeoutMs,
      maxBytes,
    });
  };
}

export async function fetchSourcesIndependently(jobs) {
  const results = [];
  const errors = [];
  await Promise.all(
    jobs.map(async ({ adapter, source, url }) => {
      try {
        results.push(await adapter.fetch(source, url));
      } catch (error) {
        errors.push({
          sourceId: source.id,
          code: error.code ?? "source_fetch_failed",
          message: error.message,
        });
      }
    }),
  );
  return { results, errors };
}
