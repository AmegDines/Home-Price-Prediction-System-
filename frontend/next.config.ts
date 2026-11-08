import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Expose the backend URL to the browser bundle.
   * Set NEXT_PUBLIC_API_BASE_URL in .env.local (never commit this file).
   * Defaults to http://localhost:8000 for local development.
   */
  env: {
    NEXT_PUBLIC_API_BASE_URL:
      process.env.NEXT_PUBLIC_API_BASE_URL || "/api",
  },

  /**
   * Standalone output — required for the multi-stage Docker build.
   * Produces a self-contained server.js with minimal node_modules.
   * See: https://nextjs.org/docs/advanced-features/output-file-tracing
   */
  output: "standalone",
};

export default nextConfig;
