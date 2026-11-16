import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Resume uploads (PDF/DOCX) go through a Server Action; files are capped at 4 MB.
    serverActions: { bodySizeLimit: "5mb" },
  },
  // The interview prototype reads its prompts from prompts/ at run time (src/lib/prompts.ts).
  outputFileTracingIncludes: { "/prototype/interview/*": ["./prompts/interviews/*.md"] },
  async redirects() {
    // The assistant moved out of the dashboard into Chat (MVP-25).
    return [{ source: "/dashboard/assistant", destination: "/chat", permanent: true }];
  },
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
