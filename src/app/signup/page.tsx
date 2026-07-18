"use client";

import { motion } from "framer-motion";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ParallaxBlob } from "@/components/effects/parallax-blob";
import { ParticleThreads } from "@/components/effects/particle-threads";
import { ThemeToggle } from "@/components/effects/theme-toggle";
import { TiltCard } from "@/components/effects/tilt-card";

export default function SignupPage() {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [awaitingVerification, setAwaitingVerification] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(
          typeof json?.error === "string"
            ? json.error
            : "Inscription impossible — vérifie les champs (mot de passe : 8 caractères minimum)."
        );
        return;
      }
      if (json?.autoVerified) {
        // Environnement sans email (dev/preprod) : connexion directe.
        await signIn("credentials", { email, password, redirect: false });
        window.location.href = "/projects";
        return;
      }
      setAwaitingVerification(true);
    } finally {
      setLoading(false);
    }
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
            {awaitingVerification ? (
              <>
                <CardHeader className="items-center text-center">
                  <CardTitle>Vérifie ta boîte mail</CardTitle>
                  <CardDescription>
                    Un lien de confirmation vient d&apos;être envoyé à {email}. Clique dessus pour
                    activer ton compte, puis connecte-toi.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="outline" className="w-full">
                    <Link href="/login">Aller à la connexion</Link>
                  </Button>
                </CardContent>
              </>
            ) : (
              <>
                <CardHeader className="items-center text-center">
                  <CardTitle>Créer un compte</CardTitle>
                  <CardDescription>Rejoins AttribMaster en quelques secondes</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <form className="space-y-3" onSubmit={submit}>
                    <div className="space-y-1.5">
                      <Label htmlFor="name">Nom</Label>
                      <Input
                        id="name"
                        autoComplete="name"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>
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
                      Créer mon compte
                    </Button>
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
                    onClick={() => {
                      setLoading(true);
                      void signIn("google", { callbackUrl: "/projects" });
                    }}
                    disabled={loading}
                  >
                    Continuer avec Google
                  </Button>

                  <p className="text-center text-sm text-muted-foreground">
                    Déjà un compte ?{" "}
                    <Link
                      href="/login"
                      className="font-medium text-primary transition-colors hover:text-primary/70"
                    >
                      Se connecter
                    </Link>
                  </p>
                </CardContent>
              </>
            )}
          </Card>
        </TiltCard>
      </motion.div>
    </div>
  );
}
