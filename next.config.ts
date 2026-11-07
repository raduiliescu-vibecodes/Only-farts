import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fully static site: every page is prerendered from data/*.json at build time.
  // Cache Components is off so unknown character URLs return a real 404
  // (dynamicParams = false) instead of a streamed soft 404.
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
