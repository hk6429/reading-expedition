export const config = {
  buildCommand: "npm run build",
  framework: null,
  outputDirectory: "dist",
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
