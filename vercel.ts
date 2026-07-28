import { deploymentEnv, routes, type VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  buildCommand: "npm run build",
  framework: null,
  outputDirectory: "dist",
  rewrites: [
    routes.rewrite(
      "/api/:path*",
      `${deploymentEnv("READING_API_ORIGIN")}/api/$1`,
    ),
  ],
  headers: [
    routes.cacheControl("/assets/(.*)", {
      public: true,
      maxAge: "1 year",
      immutable: true,
    }),
  ],
};
