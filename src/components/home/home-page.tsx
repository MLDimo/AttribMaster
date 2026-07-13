"use client";

import { motion } from "framer-motion";
import { ChartPie, Check, Database, Users, Waypoints } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ParallaxBlob } from "@/components/effects/parallax-blob";
import { ParticleThreads } from "@/components/effects/particle-threads";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/effects/motion";
import { PLANS } from "@/lib/billing/plans";

const FEATURES = [
  {
    icon: Waypoints,
    title: "6 modèles d'attribution",
    description:
      "Last Click, Linéaire, Croissant, En U, Chaînes de Markov, Valeur de Shapley — calculés directement sur tes vraies données de conversion, pas des approximations.",
  },
  {
    icon: Database,
    title: "Connecté à GA4 + BigQuery",
    description: "Aucune donnée échantillonnée : les requêtes tournent directement sur ton export BigQuery.",
  },
  {
    icon: Users,
    title: "Collaboration multi-projets",
    description:
      "Invite des collaborateurs par email, gère plusieurs projets avec des comptes de facturation partagés ou séparés.",
  },
  {
    icon: ChartPie,
    title: "Dashboard premium",
    description:
      "Graphiques animés, comparaisons de périodes (N-1, semaine, mois dernier), détail transaction par transaction.",
  },
];

export function HomePage({ authenticated }: { authenticated: boolean }) {
  const ctaHref = authenticated ? "/projects" : "/login";
  const ctaLabel = authenticated ? "Aller à mes projets" : "Se connecter";

  return (
    <div className="relative flex min-h-svh flex-col overflow-x-hidden bg-background">
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between p-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <Image src="/logo-icon.png" alt="" width={32} height={32} className="drop-shadow-sm" priority />
          <span className="font-semibold">AttribMaster</span>
        </div>
        <Button asChild size="sm">
          <Link href={ctaHref}>{ctaLabel}</Link>
        </Button>
      </header>

      <section className="relative flex flex-col items-center overflow-hidden px-4 pt-10 pb-20 text-center sm:pt-16">
        <ParallaxBlob className="pointer-events-none absolute -top-32 -left-32 size-[28rem]" />
        <ParallaxBlob className="pointer-events-none absolute -right-32 bottom-0 size-[28rem]" />
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="pointer-events-none absolute inset-0 blur-[6px]"
        >
          <ParticleThreads />
        </motion.div>
        <div className="blur-veil pointer-events-none absolute inset-0" />

        <div className="relative z-10 flex max-w-2xl flex-col items-center gap-5">
          <FadeIn className="rounded-full border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
            Attribution marketing multi-touch
          </FadeIn>
          <FadeIn delay={0.05}>
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Sache enfin quel canal convertit vraiment.
            </h1>
          </FadeIn>
          <FadeIn delay={0.1}>
            <p className="text-balance text-muted-foreground sm:text-lg">
              AttribMaster connecte GA4 et BigQuery pour te montrer la vraie contribution de chaque canal
              marketing, calculée directement sur tes données — pas sur des règles arbitraires.
            </p>
          </FadeIn>
          <FadeIn delay={0.15} className="flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link href={ctaHref}>{ctaLabel}</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="#modeles">Voir les modèles</Link>
            </Button>
          </FadeIn>
        </div>
      </section>

      <section id="modeles" className="relative z-10 mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <StaggerContainer className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <StaggerItem key={feature.title}>
              <Card className="h-full">
                <CardHeader>
                  <div className="mb-1 flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <feature.icon className="size-5" />
                  </div>
                  <CardTitle>{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </section>

      <section className="relative z-10 mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <FadeIn className="mb-8 flex flex-col items-center gap-2 text-center">
          <h2 className="text-2xl font-semibold">Un plan pour chaque taille de projet</h2>
          <p className="text-sm text-muted-foreground">Facturation par projet, mensuelle ou annuelle.</p>
        </FadeIn>
        <StaggerContainer className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {PLANS.map((plan) => (
            <StaggerItem key={plan.id}>
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>{plan.label}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div>
                    {plan.selfServe ? (
                      <>
                        <span className="font-mono text-2xl font-semibold tabular-nums">
                          {plan.monthlyPriceEuros}€
                        </span>
                        <span className="text-sm text-muted-foreground"> / mois</span>
                      </>
                    ) : (
                      <>
                        <span className="font-mono text-2xl font-semibold tabular-nums">
                          À partir de {plan.fromPriceEuros}€
                        </span>
                        <span className="text-sm text-muted-foreground"> / mois</span>
                      </>
                    )}
                  </div>
                  <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" />
                    {plan.sessionLimitLabel}
                  </p>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </section>

      <footer className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center gap-2 px-4 py-10 text-center text-sm text-muted-foreground sm:px-6">
        <span>© {new Date().getFullYear()} AttribMaster</span>
        <Link href={ctaHref} className="font-medium text-primary transition-colors hover:text-primary/70">
          {ctaLabel}
        </Link>
      </footer>
    </div>
  );
}
