import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/cron/nightly-attribution": ["./sql/**"],
    "/api/projects/[id]/connect-bigquery": ["./sql/**"],
  },
};

export default nextConfig;
