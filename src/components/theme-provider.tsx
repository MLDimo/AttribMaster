"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Bascule clair/sombre via la classe `.dark` sur `<html>` (déjà présente dans
 * globals.css). `next-themes` injecte un script bloquant avant hydratation
 * pour éviter le flash de mauvais thème.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}
