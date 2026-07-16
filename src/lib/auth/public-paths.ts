/** Comparaison exacte (pas de préfixe) : "/" ne doit pas rendre tout le site public. */
export const PUBLIC_PATHS = [
  "/",
  "/login",
  "/mentions-legales",
  "/cgu",
  "/cgv",
  "/politique-de-confidentialite",
  "/opengraph-image",
  "/twitter-image",
  "/robots.txt",
  "/sitemap.xml",
];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.includes(pathname);
}

export function isApiPath(pathname: string): boolean {
  return pathname.startsWith("/api");
}

/** true si la requête doit être redirigée vers /login (non authentifiée, page ni publique ni API). */
export function shouldRedirectToLogin(pathname: string, isAuthenticated: boolean): boolean {
  return !isAuthenticated && !isPublicPath(pathname) && !isApiPath(pathname);
}
