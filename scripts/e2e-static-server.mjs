import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const [nodeMajor, nodeMinor] = process.versions.node.split(".").map(Number);
if (nodeMajor < 20 || (nodeMajor === 20 && nodeMinor < 11)) {
  process.stderr.write("E2E server 需要 Node.js 20.11 以上版本。\n");
  process.exit(1);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// 8788 is Wrangler's common local port and may already be occupied by another
// project. Keep the E2E fixture isolated so Playwright probes the intended app.
const port = Number(process.env.PORT ?? 41789);
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

function safeFile(pathname) {
  const decoded = decodeURIComponent(pathname);
  const relative = decoded === "/" ? "index.html" : decoded.slice(1);
  const candidate = normalize(join(root, relative));
  if (!candidate.startsWith(`${root}/`)) return null;
  try {
    return statSync(candidate).isFile() ? candidate : null;
  } catch {
    return null;
  }
}

createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
  if (url.pathname.startsWith("/api/")) {
    response.writeHead(404, {
      "content-type": "application/json; charset=utf-8",
    });
    response.end(
      JSON.stringify({
        error: { code: "e2e_api_unavailable", message: "E2E 使用本機安全文章" },
      }),
    );
    return;
  }
  const file = safeFile(url.pathname) ?? join(root, "index.html");
  response.writeHead(200, {
    "content-type": contentTypes[extname(file)] ?? "application/octet-stream",
  });
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  createReadStream(file).pipe(response);
}).listen(port, "127.0.0.1", () => {
  process.stdout.write(`E2E server ready on http://127.0.0.1:${port}\n`);
});
