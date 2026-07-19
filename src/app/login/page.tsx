"use client";

import { motion } from "framer-motion";
import { signIn } from "next-auth/react";
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

function LoginPageInner() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const verified = useSearchParams().get("verified");

  async function signInWithGoogle() {
    setLoading(true);
    await signIn("google", { callbackUrl: "/projects" });
  }

  async function signInWithCredentials(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError(
        "Email ou mot de passe incorrect. Si tu viens de créer ton compte, pense à cliquer le lien de confirmation reçu par email."
      );
      return;
    }
    window.location.href = "/projects";
  }

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
          <CardHeader className="items-center text-center">
            <CardTitle>AttribMaster</CardTitle>
            <CardDescription>Connectez-vous pour accéder à vos projets</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {verified === "1" ? (
              <p className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
                Email confirmé — tu peux te connecter.
              </p>
            ) : null}
            {verified === "invalid" ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                Lien de confirmation invalide ou expiré. Réinscris-toi pour recevoir un nouveau lien.
              </p>
            ) : null}
            <form className="space-y-3" onSubmit={signInWithCredentials}>
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
              <div className="space-y-1.5">
                <Label htmlFor="password">Mot de passe</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <Button type="submit" className="w-full" disabled={loading}>
                Se connecter
              </Button>
              <p className="text-right text-xs">
                <Link
                  href="/reset-password"
                  className="text-muted-foreground transition-colors hover:text-primary"
                >
                  Mot de passe oublié ?
                </Link>
              </p>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">ou</span>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={signInWithGoogle}
              disabled={loading}
            >
              Se connecter avec Google
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Pas encore de compte ?{" "}
              <Link
                href="/signup"
                className="font-medium text-primary transition-colors hover:text-primary/70"
              >
                Créer un compte
              </Link>
            </p>
          </CardContent>
        </Card>
      </TiltCard>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  // useSearchParams impose une frontière Suspense sur une page pré-rendue.
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  );
}
