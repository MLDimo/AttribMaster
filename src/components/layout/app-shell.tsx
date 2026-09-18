"use client";

import { AnimatePresence, motion } from "framer-motion";
import { LogOut, Menu, X } from "lucide-react";
import { signOut } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { ParallaxBlob } from "@/components/effects/parallax-blob";
import { ThemeToggle } from "@/components/effects/theme-toggle";

const NAV_ITEMS = [
  { href: "/projects", label: "Projets" },
  { href: "/account", label: "Mon compte" },
];

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className="relative rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-accent-foreground data-[active=true]:text-accent-foreground"
      data-active={active}
    >
      {active && (
        <motion.span
          layoutId="nav-active-pill"
          className="absolute inset-0 rounded-md bg-accent"
          transition={{ type: "spring", stiffness: 400, damping: 32 }}
        />
      )}
      <span className="relative z-10">{label}</span>
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Ferme le menu mobile à chaque changement de route (ajustement pendant le
  // rendu plutôt qu'un setState synchrone dans un effet).
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setMobileOpen(false);
  }

  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden">
      <ParallaxBlob className="fixed -top-40 -right-40 z-0 size-[36rem] opacity-40" />
      <header className="sticky top-0 z-20 border-b bg-background/80 shadow-xs backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2.5 p-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Link href="/projects" className="flex items-center gap-2.5">
              <Image src="/logo-icon.png" alt="" width={36} height={36} className="drop-shadow-sm" priority />
              <div>
                <h1 className="text-lg leading-tight font-semibold">AttribMaster</h1>
              </div>
            </Link>
            <nav className="hidden items-center gap-1 md:flex">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
                />
              ))}
            </nav>
          </div>
          <div className="hidden items-center gap-3 md:flex">
            <ThemeToggle />
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <LogOut className="size-4" />
              Déconnexion
            </button>
          </div>

          <button
            aria-label={mobileOpen ? "Fermer le menu" : "Ouvrir le menu"}
            onClick={() => setMobileOpen((v) => !v)}
            className="flex size-9 items-center justify-center rounded-md text-foreground transition-colors hover:bg-accent md:hidden"
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>

        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden border-t md:hidden"
            >
              <nav className="flex flex-col gap-1 p-4">
                {NAV_ITEMS.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      data-active={active}
                      className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground data-[active=true]:bg-accent data-[active=true]:text-accent-foreground"
                    >
                      {item.label}
                    </Link>
                  );
                })}
                <div className="mt-1 flex items-center justify-between border-t pt-3">
                  <span className="px-3 text-xs font-medium text-muted-foreground">Thème</span>
                  <ThemeToggle />
                </div>
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="flex items-center gap-1.5 rounded-md px-3 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <LogOut className="size-4" />
                  Déconnexion
                </button>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </header>
      <AnimatePresence mode="wait">
        <motion.main
          key={pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6"
        >
          {children}
        </motion.main>
      </AnimatePresence>
    </div>
  );
}
