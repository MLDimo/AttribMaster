import type { MetadataRoute } from "next";

const SITE_URL = "https://attribmaster.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/login", "/cgu", "/cgv", "/mentions-legales", "/politique-de-confidentialite"];

  return routes.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: new Date(),
  }));
}
