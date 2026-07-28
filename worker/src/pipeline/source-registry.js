import { hashSecret } from "../auth/teacher-auth.js";

const REQUIRED_FIELDS = [
  "id",
  "name",
  "baseUrl",
  "publisher",
  "allowedUsage",
  "extractScope",
  "adapter",
];

function canonicalizeUrl(value) {
  const url = new URL(value);
  url.hash = "";
  return url.toString();
}

export function createSourceRegistry(sources) {
  if (!Array.isArray(sources) || sources.length === 0) {
    throw new TypeError("at least one source is required");
  }
  const byHost = new Map();
  const byId = new Map();
  for (const source of sources) {
    for (const field of REQUIRED_FIELDS) {
      if (typeof source[field] !== "string" || source[field].trim() === "") {
        throw new TypeError(`source ${field} is required`);
      }
    }
    if (!source.license || typeof source.license.type !== "string") {
      throw new TypeError("source license is required");
    }
    const baseUrl = new URL(source.baseUrl);
    if (!["http:", "https:"].includes(baseUrl.protocol)) {
      throw new TypeError("source baseUrl scheme is invalid");
    }
    if (byHost.has(baseUrl.hostname) || byId.has(source.id)) {
      throw new TypeError("source hostname and id must be unique");
    }
    const frozen = Object.freeze({ ...source, hostname: baseUrl.hostname });
    byHost.set(baseUrl.hostname, frozen);
    byId.set(source.id, frozen);
  }

  return Object.freeze({
    allowedHosts: new Set(byHost.keys()),
    requireForUrl(value) {
      const hostname = new URL(value).hostname;
      const source = byHost.get(hostname);
      if (!source) throw new TypeError("source host is not allowlisted");
      return source;
    },
    get(id) {
      return byId.get(id) ?? null;
    },
    list() {
      return [...byId.values()];
    },
  });
}

export async function fingerprintSourceItem({
  canonicalUrl,
  title,
  extract,
}) {
  const normalizedUrl = canonicalizeUrl(canonicalUrl);
  const normalizedContent = [title, extract]
    .map((value) => String(value ?? "").trim().replace(/\s+/g, " "))
    .join("\n");
  return {
    canonicalUrl: normalizedUrl,
    contentFingerprint: await hashSecret(normalizedContent),
  };
}
