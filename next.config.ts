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
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Force HTTPS pendant 2 ans, sous-domaines inclus.
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          // Pas d'iframe tiers (clickjacking).
          { key: "X-Frame-Options", value: "DENY" },
          // Pas de sniffing de type MIME.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // N'envoie l'URL complète qu'en same-origin.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Coupe les APIs navigateur inutilisées par l'app.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
