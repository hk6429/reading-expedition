const apiOrigin = process.env.READING_API_ORIGIN;

export const config = {
  buildCommand: "npm run build",
  framework: null,
  outputDirectory: "dist",
  rewrites: apiOrigin
    ? [
        {
          source: "/api/:path*",
          destination: `${apiOrigin}/api/:path*`,
        },
      ]
    : [],
  headers: [
    {
      source: "/assets/(.*)",
      headers: [
        {
          key: "Cache-Control",
          value: "public, max-age=31536000, immutable",
        },
      ],
    },
  ],
};
