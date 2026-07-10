"use client";

import { BarChart3, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
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
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                <BarChart3 className="size-5" />
              </div>
              <div>
                <h1 className="text-lg leading-tight font-semibold">AttribMaster</h1>
                <p className="text-xs text-muted-foreground">GA4 · BigQuery · Multi-touch</p>
              </div>
            </Link>
            <nav className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    {item.label}
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
      <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6">{children}</main>
    </div>
  );
}
