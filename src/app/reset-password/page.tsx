"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ParallaxBlob } from "@/components/effects/parallax-blob";
import { ParticleThreads } from "@/components/effects/particle-threads";
import { ThemeToggle } from "@/components/effects/theme-toggle";
import { TiltCard } from "@/components/effects/tilt-card";

/** Mode "demande" : saisie de l'email, envoi du lien. */
function RequestForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setError(typeof json?.error === "string" ? json.error : "Demande impossible, réessaie.");
        return;
      }
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <>
        <CardHeader className="items-center text-center">
          <CardTitle>Vérifie ta boîte mail</CardTitle>
          <CardDescription>
            Si un compte existe avec l&apos;adresse {email}, un lien de réinitialisation vient de lui
            être envoyé (valable 1 heure).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">Retour à la connexion</Link>
          </Button>
        </CardContent>
      </>
    );
  }

  return (
    <>
      <CardHeader className="items-center text-center">
        <CardTitle>Mot de passe oublié</CardTitle>
        <CardDescription>
          Entre ton email : on t&apos;envoie un lien pour choisir un nouveau mot de passe
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form className="space-y-3" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={loading}>
            Envoyer le lien
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-medium text-primary transition-colors hover:text-primary/70">
            Retour à la connexion
          </Link>
        </p>
      </CardContent>
    </>
  );
}

/** Mode "réinitialisation" : arrivée depuis le lien email, saisie du nouveau mot de passe. */
function ResetForm({ email, token }: { email: string; token: string }) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token, password }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setError(
          typeof json?.error === "string"
            ? json.error
            : "Réinitialisation impossible (mot de passe : 8 caractères minimum)."
        );
        return;
      }
      setDone(true);
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <>
        <CardHeader className="items-center text-center">
          <CardTitle>Mot de passe changé</CardTitle>
          <CardDescription>Tu peux maintenant te connecter avec ton nouveau mot de passe.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/login">Se connecter</Link>
          </Button>
        </CardContent>
      </>
    );
  }

  return (
    <>
      <CardHeader className="items-center text-center">
        <CardTitle>Nouveau mot de passe</CardTitle>
        <CardDescription>Choisis un nouveau mot de passe pour {email}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form className="space-y-3" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label htmlFor="password">Nouveau mot de passe</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">8 caractères minimum</p>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={loading}>
            Changer le mot de passe
          </Button>
        </form>
      </CardContent>
    </>
  );
}

function ResetPasswordInner() {
  const params = useSearchParams();
  const email = params.get("email");
  const token = params.get("token");

  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-background p-6 [--background:#F8F3EC] dark:[--background:#1c140d]">
      <ParallaxBlob className="-top-32 -left-32 size-[28rem]" />
      <ParallaxBlob className="-right-40 -bottom-40 size-[32rem]" />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        className="absolute inset-0 blur-[6px]"
      >
        <ParticleThreads />
      </motion.div>
      <div className="blur-veil pointer-events-none absolute inset-0" />
      <ThemeToggle className="absolute top-4 right-4 z-10" />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 22 }}
        className="relative w-full max-w-sm"
      >
        <TiltCard>
          <Card className="shadow-xl">
            {email && token ? <ResetForm email={email} token={token} /> : <RequestForm />}
          </Card>
        </TiltCard>
      </motion.div>
    </div>
  );
}

export default function ResetPasswordPage() {
  // useSearchParams impose une frontière Suspense sur une page pré-rendue.
  return (
    <Suspense>
      <ResetPasswordInner />
    </Suspense>
  );
}
