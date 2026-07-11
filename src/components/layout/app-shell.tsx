"use client";

import { AnimatePresence, motion } from "framer-motion";
import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ParallaxBlob } from "@/components/effects/parallax-blob";

const NAV_ITEMS = [
  { href: "/projects", label: "Projets" },
  { href: "/account", label: "Mon compte" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden">
      <ParallaxBlob className="fixed -top-40 -right-40 z-0 size-[36rem] opacity-40" />
      <header className="sticky top-0 z-10 border-b bg-background/80 shadow-xs backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2.5 p-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Link href="/projects" className="flex items-center gap-2.5">
              <Image src="/logo-icon.png" alt="" width={36} height={36} className="drop-shadow-sm" priority />
              <div>
                <h1 className="text-lg leading-tight font-semibold">AttribMaster</h1>
              </div>
            </Link>
            <nav className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
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
                    <span className="relative z-10">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <LogOut className="size-4" />
              Déconnexion
            </button>
          </div>
        </div>
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
