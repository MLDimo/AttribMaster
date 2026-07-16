import type { MetadataRoute } from "next";

const SITE_URL = "https://attribmaster.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/projects", "/account"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
