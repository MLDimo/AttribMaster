"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CustomPlanDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/custom-plan-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, name, email, company, message }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setError(json?.error ?? "Impossible d'envoyer la demande.");
        return;
      }
      setSent(true);
    } finally {
      setSubmitting(false);
    }
  }

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) {
      setTimeout(() => {
        setSent(false);
        setName("");
        setEmail("");
        setCompany("");
        setMessage("");
      }, 200);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Plan sur mesure</DialogTitle>
          <DialogDescription>
            Décris-nous ton besoin, on te recontacte avec une proposition adaptée.
          </DialogDescription>
        </DialogHeader>

        {sent ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center text-sm">
            <CheckCircle2 className="size-8 text-success" />
            <p className="font-medium">Demande envoyée</p>
            <p className="text-muted-foreground">On te recontacte rapidement.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="custom-name">Nom</Label>
              <Input id="custom-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="custom-email">Email</Label>
              <Input
                id="custom-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="custom-company">Entreprise (optionnel)</Label>
              <Input id="custom-company" value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="custom-message">Besoin (optionnel)</Label>
              <textarea
                id="custom-message"
                className="min-h-20 rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="size-4 animate-spin" /> : "Envoyer la demande"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
