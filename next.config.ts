import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/cron/nightly-attribution": ["./sql/**"],
    "/api/projects/[id]/connect-bigquery": ["./sql/**"],
  },
  images: {
    // Photos de profil des collaborateurs (avatar Google renvoyé par l'OAuth).
    remotePatterns: [{ protocol: "https", hostname: "lh3.googleusercontent.com" }],
  },
};

export default nextConfig;
