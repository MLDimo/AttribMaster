"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  ChartPie,
  Check,
  CreditCard,
  Database,
  FileSpreadsheet,
  FilterX,
  GitCompare,
  Sparkles,
  TrendingDown,
  Users,
  Waypoints,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AttributionDemo } from "@/components/home/attribution-demo";
import { ParallaxBlob } from "@/components/effects/parallax-blob";
import { ParticleThreads } from "@/components/effects/particle-threads";
import { ThemeToggle } from "@/components/effects/theme-toggle";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/effects/motion";
import { PLANS, SETUP_FEE_EUROS } from "@/lib/billing/plans";

const NAV_LINKS = [
  { href: "#demo", label: "Démo" },
  { href: "#fonctionnalites", label: "Fonctionnalités" },
  { href: "#tarifs", label: "Tarifs" },
  { href: "#faq", label: "FAQ" },
];

const PROBLEMS = [
  {
    icon: TrendingDown,
    title: "Le dernier clic ment",
    description:
      "100 % du crédit va au dernier canal touché — même quand ce sont tes campagnes payantes qui ont déclenché l'intérêt des semaines avant.",
  },
  {
    icon: FilterX,
    title: "GA4 s'arrête au premier niveau",
    description:
      "Les rapports natifs s'appuient sur des règles simplistes, sans te laisser choisir un modèle adapté à ton cycle de vente.",
  },
  {
    icon: FileSpreadsheet,
    title: "Excel ne scale pas",
    description:
      "Exporter les parcours multi-touch dans un tableur et calculer une valeur de Shapley à la main ? Personne n'a le temps pour ça.",
  },
];

const FEATURES = [
  {
    icon: Waypoints,
    title: "6 modèles d'attribution",
    description:
      "Last Click, Linéaire, Croissant, En U, Chaînes de Markov, Valeur de Shapley — calculés sur tes vraies données de conversion.",
  },
  {
    icon: Database,
    title: "Connecté à GA4 + BigQuery",
    description: "Aucune donnée échantillonnée : les requêtes tournent directement sur ton export BigQuery.",
  },
  {
    icon: GitCompare,
    title: "Comparaisons de périodes",
    description: "N-1, semaine dernière, mois dernier — repère les tendances en un clic.",
  },
  {
    icon: ChartPie,
    title: "Dashboard premium",
    description: "Graphiques animés, détail transaction par transaction, recherche et tri instantanés.",
  },
  {
    icon: Users,
    title: "Collaboration multi-projets",
    description: "Invite des collaborateurs par email, sans limite de nombre, projet par projet.",
  },
  {
    icon: CreditCard,
    title: "Facturation flexible",
    description: "Un compte de facturation réutilisable sur plusieurs projets, mensuel ou annuel.",
  },
];

const PROCESS_STEPS = [
  {
    step: "01",
    title: "Connecte ton compte Google",
    description: "OAuth en deux clics, aucune clé API à copier-coller.",
  },
  {
    step: "02",
    title: "Choisis ton dataset BigQuery",
    description: "Sélectionne le projet GCP et le dataset GA4 à analyser.",
  },
  {
    step: "03",
    title: "Choisis un modèle d'attribution",
    description: "Bascule entre les 6 modèles à tout moment, inclus dans tous les plans.",
  },
  {
    step: "04",
    title: "Découvre tes vrais chiffres",
    description: "Dashboard, transactions, comparaisons de périodes — tout est prêt.",
  },
];

const FAQ_ITEMS = [
  {
    q: "Ai-je besoin de compétences techniques ?",
    a: "Non. La connexion se fait via OAuth Google en quelques clics — aucune requête SQL à écrire.",
  },
  {
    q: "Mes données sont-elles échantillonnées ?",
    a: "Non, toutes les requêtes tournent directement sur ton export BigQuery complet, sans échantillonnage.",
  },
  {
    q: "Puis-je changer de modèle d'attribution à tout moment ?",
    a: "Oui, bascule entre les 6 modèles en un clic, à tout moment, inclus dans tous les plans.",
  },
  {
    q: "Un projet peut-il avoir plusieurs collaborateurs ?",
    a: "Oui, invite qui tu veux par email, sans limite de nombre.",
  },
  {
    q: "Un compte de facturation peut-il couvrir plusieurs projets ?",
    a: "Oui : un même compte de facturation peut être réutilisé sur autant de projets que tu veux, ou tu peux en créer un nouveau à chaque fois.",
  },
  {
    q: "Que couvrent les frais d'installation ?",
    a: "Les 50€ de frais d'installation couvrent tout le setup de ta connexion BigQuery — projet GCP, dataset GA4, table d'attribution. Offerts si tu choisis la facturation annuelle.",
  },
  {
    q: "Puis-je annuler à tout moment ?",
    a: "Oui, résiliation en un clic depuis ton espace de facturation, aucun engagement.",
  },
  {
    q: "Que couvre le plan Sur mesure ?",
    a: "Les volumes importants ou les besoins spécifiques — contacte-nous, on construit une offre adaptée.",
  },
];

export function HomePage({ authenticated }: { authenticated: boolean }) {
  const ctaHref = authenticated ? "/projects" : "/login";
  const ctaLabel = authenticated ? "Aller à mes projets" : "Se connecter";
  const [interval, setInterval] = useState<"monthly" | "annual">("monthly");

  return (
    <div className="relative flex min-h-svh flex-col overflow-x-hidden bg-background">
      <header className="relative z-20 mx-auto flex w-full max-w-6xl items-center justify-between p-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <Image src="/logo-icon.png" alt="" width={32} height={32} className="drop-shadow-sm" priority />
          <span className="font-semibold">AttribMaster</span>
        </div>
        <nav className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild size="sm">
            <Link href={ctaHref}>{ctaLabel}</Link>
          </Button>
        </div>
      </header>

      {/* Hero */}
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
              Marre de ne rien comprendre à ton attribution marketing ?
            </h1>
          </FadeIn>
          <FadeIn delay={0.1}>
            <p className="text-balance text-muted-foreground sm:text-lg">
              AttribMaster reconstruit le vrai parcours de conversion depuis BigQuery — 6 modèles
              d&apos;attribution calculés sur tes données réelles, sans échantillonnage.
            </p>
          </FadeIn>
          <FadeIn delay={0.15} className="flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link href={ctaHref}>
                {ctaLabel}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="#demo">Voir la démo</a>
            </Button>
          </FadeIn>
          <FadeIn delay={0.2} className="text-xs text-muted-foreground">
            Sans engagement · Résiliable à tout moment · Connexion Google en 2 minutes
          </FadeIn>
        </div>
      </section>

      {/* Problème */}
      <section className="relative z-10 mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <FadeIn className="mb-8 flex flex-col items-center gap-2 text-center">
          <h2 className="text-2xl font-semibold">Tu reconnais ce problème ?</h2>
        </FadeIn>
        <StaggerContainer className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {PROBLEMS.map((problem) => (
            <StaggerItem key={problem.title}>
              <Card className="h-full">
                <CardHeader>
                  <div className="mb-1 flex size-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                    <problem.icon className="size-5" />
                  </div>
                  <CardTitle>{problem.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{problem.description}</p>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </section>

      {/* Démo / preuve */}
      <section id="demo" className="relative z-10 mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
        <FadeIn className="mb-8 flex flex-col items-center gap-2 text-center">
          <h2 className="text-2xl font-semibold">Le même mois, deux vérités différentes</h2>
          <p className="text-sm text-muted-foreground">Change juste de modèle d&apos;attribution.</p>
          <p className="text-sm text-muted-foreground">6 modèles d&apos;attribution disponibles.</p>
        </FadeIn>
        <FadeIn delay={0.1}>
          <Card>
            <CardContent className="pt-6">
              <AttributionDemo />
            </CardContent>
          </Card>
        </FadeIn>
      </section>

      {/* Fonctionnalités */}
      <section id="fonctionnalites" className="relative z-10 mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <FadeIn className="mb-8 flex flex-col items-center gap-2 text-center">
          <h2 className="text-2xl font-semibold">Tout ce qu&apos;il faut pour arbitrer ton budget</h2>
        </FadeIn>
        <StaggerContainer className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

      {/* Process */}
      <section className="relative z-10 mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <FadeIn className="mb-8 flex flex-col items-center gap-2 text-center">
          <h2 className="text-2xl font-semibold">Opérationnel en quelques minutes</h2>
        </FadeIn>
        <StaggerContainer className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PROCESS_STEPS.map((step) => (
            <StaggerItem key={step.step}>
              <div className="flex flex-col gap-2">
                <span className="font-mono text-3xl font-semibold text-primary/40">{step.step}</span>
                <h3 className="font-semibold">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </section>

      {/* Tarifs */}
      <section id="tarifs" className="relative z-10 mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <FadeIn className="mb-8 flex flex-col items-center gap-2 text-center">
          <h2 className="text-2xl font-semibold">Un plan pour chaque taille de projet</h2>
          <p className="text-sm text-muted-foreground">Facturation par projet, mensuelle ou annuelle.</p>
        </FadeIn>

        <FadeIn delay={0.05} className="mb-8 flex items-center justify-center gap-1 self-center rounded-full border bg-muted/50 p-1 text-sm">
          <button
            onClick={() => setInterval("monthly")}
            className={`rounded-full px-3.5 py-1.5 font-medium transition-colors ${
              interval === "monthly" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Mensuel
          </button>
          <button
            onClick={() => setInterval("annual")}
            className={`rounded-full px-3.5 py-1.5 font-medium transition-colors ${
              interval === "annual" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Annuel
          </button>
          {interval === "annual" && (
            <span className="mr-1.5 rounded-full bg-success/15 px-2 py-1 text-xs font-medium text-success">
              Frais d&apos;installation offerts
            </span>
          )}
        </FadeIn>

        <StaggerContainer className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {PLANS.map((plan) => {
            const isPopular = plan.id === "standard";
            return (
              <StaggerItem key={plan.id}>
                <Card className={`relative h-full ${isPopular ? "border-primary shadow-md" : ""}`}>
                  {isPopular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                      Le plus populaire
                    </span>
                  )}
                  <CardHeader>
                    <CardTitle>{plan.label}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    <div>
                      {plan.selfServe ? (
                        <>
                          <span className="font-mono text-2xl font-semibold tabular-nums">
                            {interval === "monthly" ? plan.monthlyPriceEuros : (plan.monthlyPriceEuros ?? 0) * 12}€
                          </span>
                          <span className="text-sm text-muted-foreground">{interval === "monthly" ? " / mois" : " / an"}</span>
                          {interval === "monthly" && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              + {SETUP_FEE_EUROS}€ de frais d&apos;installation (setup BigQuery inclus)
                            </p>
                          )}
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
                    <Button asChild variant={isPopular ? "default" : "outline"} className="mt-2 w-full">
                      <Link href={ctaHref}>{plan.selfServe ? "S'abonner" : "Nous contacter"}</Link>
                    </Button>
                  </CardContent>
                </Card>
              </StaggerItem>
            );
          })}
        </StaggerContainer>
      </section>

      {/* FAQ */}
      <section id="faq" className="relative z-10 mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
        <FadeIn className="mb-8 flex flex-col items-center gap-2 text-center">
          <h2 className="text-2xl font-semibold">Questions fréquentes</h2>
        </FadeIn>
        <FadeIn delay={0.1}>
          <Card>
            <CardContent className="pt-6">
              <Accordion type="single" collapsible className="w-full">
                {FAQ_ITEMS.map((item) => (
                  <AccordionItem key={item.q} value={item.q}>
                    <AccordionTrigger>{item.q}</AccordionTrigger>
                    <AccordionContent>
                      <p className="text-sm text-muted-foreground">{item.a}</p>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </FadeIn>
      </section>

      {/* CTA finale */}
      <section className="relative z-10 mx-auto w-full max-w-2xl px-4 py-20 text-center sm:px-6">
        <FadeIn className="flex flex-col items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="size-6" />
          </div>
          <h2 className="text-2xl font-semibold text-balance sm:text-3xl">
            Prêt à savoir ce qui convertit vraiment ?
          </h2>
          <p className="text-muted-foreground">
            Connecte ton compte Google, choisis un projet, et vois tes vrais chiffres en quelques minutes.
          </p>
          <Button size="lg" asChild>
            <Link href={ctaHref}>
              {ctaLabel}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </FadeIn>
      </section>

      <footer className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center gap-3 border-t px-4 py-10 text-center text-sm text-muted-foreground sm:px-6">
        <span>© {new Date().getFullYear()} AttribMaster</span>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link href={ctaHref} className="font-medium text-primary transition-colors hover:text-primary/70">
            {ctaLabel}
          </Link>
          <Link href="/mentions-legales" className="transition-colors hover:text-foreground">
            Mentions légales
          </Link>
          <Link href="/cgu" className="transition-colors hover:text-foreground">
            CGU
          </Link>
          <Link href="/cgv" className="transition-colors hover:text-foreground">
            CGV
          </Link>
        </div>
      </footer>
    </div>
  );
}
