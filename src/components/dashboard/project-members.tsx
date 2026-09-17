"use client";

import { ChevronRight, Clock, Crown, Eye, Loader2, Mail, UserPlus, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { StaggerContainer, StaggerItem } from "@/components/effects/motion";
import type { ProjectMember, ProjectMemberInvite, ProjectMemberRole } from "@/lib/projects/types";

const AVATAR_TINTS = [
  "bg-chart-1/70",
  "bg-chart-4/70",
  "bg-chart-7/70",
  "bg-chart-10/70",
  "bg-chart-3/70",
];

function tintForMember(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  return AVATAR_TINTS[Math.abs(hash) % AVATAR_TINTS.length];
}

function initialsFor(member: ProjectMember): string {
  const source = member.name?.trim() || member.email;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function Avatar({ member, className }: { member: ProjectMember; className?: string }) {
  if (member.image) {
    return (
      <Image
        src={member.image}
        alt=""
        width={32}
        height={32}
        className={`size-8 shrink-0 rounded-full object-cover ring-2 ring-card ${className ?? ""}`}
      />
    );
  }
  return (
    <div
      className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-foreground ring-2 ring-card ${tintForMember(member.user_id)} ${className ?? ""}`}
    >
      {initialsFor(member)}
    </div>
  );
}

const MAX_STACK = 3;

export function ProjectMembers({ projectId }: { projectId: string }) {
  const [members, setMembers] = useState<ProjectMember[] | null>(null);
  const [invites, setInvites] = useState<ProjectMemberInvite[]>([]);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invitedEmail, setInvitedEmail] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);
  const [cancelingInvite, setCancelingInvite] = useState<string | null>(null);

  function load() {
    fetch(`/api/projects/${projectId}/members`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { members: ProjectMember[]; invites: ProjectMemberInvite[] } | null) => {
        if (json) {
          setMembers(json.members);
          setInvites(json.invites);
        }
      });
  }

  useEffect(load, [projectId]);

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setInvitedEmail(null);
    setAdding(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Impossible d'ajouter ce collaborateur.");
        return;
      }
      // 202 : pas encore de compte AttribMaster avec cet email — une invitation
      // vient d'être envoyée, elle apparaîtra "en attente" dans la liste.
      if (res.status === 202) setInvitedEmail(email);
      setEmail("");
      load();
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(userId: string) {
    setRemovingId(userId);
    try {
      const res = await fetch(`/api/projects/${projectId}/members/${userId}`, { method: "DELETE" });
      if (res.ok) setMembers((prev) => prev?.filter((m) => m.user_id !== userId) ?? prev);
    } finally {
      setRemovingId(null);
    }
  }

  async function handleCancelInvite(inviteEmail: string) {
    setCancelingInvite(inviteEmail);
    try {
      const res = await fetch(`/api/projects/${projectId}/invites/${encodeURIComponent(inviteEmail)}`, {
        method: "DELETE",
      });
      if (res.ok) setInvites((prev) => prev.filter((i) => i.email !== inviteEmail));
    } finally {
      setCancelingInvite(null);
    }
  }

  async function handleRoleChange(userId: string, role: ProjectMemberRole) {
    setUpdatingRoleId(userId);
    try {
      const res = await fetch(`/api/projects/${projectId}/members/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (res.ok) {
        const json: { member: ProjectMember } = await res.json();
        setMembers((prev) => prev?.map((m) => (m.user_id === userId ? json.member : m)) ?? prev);
      }
    } finally {
      setUpdatingRoleId(null);
    }
  }

  const visible = members?.slice(0, MAX_STACK) ?? [];
  const overflow = members ? Math.max(0, members.length - MAX_STACK) : 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-fit items-center gap-1.5 rounded-full border bg-muted/50 py-1 pr-2 pl-1 transition-colors hover:bg-accent"
      >
        <div className="flex -space-x-2">
          {visible.length === 0 ? (
            <div className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground ring-2 ring-card">
              <UserPlus className="size-3.5" />
            </div>
          ) : (
            visible.map((member) => <Avatar key={member.user_id} member={member} />)
          )}
          {overflow > 0 && (
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground ring-2 ring-card">
              +{overflow}
            </div>
          )}
        </div>
        <ChevronRight className="size-4 text-muted-foreground" />
      </button>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Collaborateurs</DialogTitle>
          <DialogDescription>
            Par défaut, les personnes ajoutées ici ont un accès en lecture seule : elles peuvent
            consulter ce projet et son dashboard, mais ne peuvent rien modifier — idéal pour un
            client final ou un stagiaire. Passe un collaborateur en <strong>Owner</strong> pour lui
            donner un accès de gestion complet sur ce projet (connexion, abonnement, autres
            collaborateurs).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleAdd} className="flex items-start gap-2">
          <div className="flex-1">
            <Input
              type="email"
              placeholder="email@exemple.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={adding}
            />
            {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
            {invitedEmail && !error && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                {invitedEmail} n&apos;a pas encore de compte AttribMaster : une invitation par email
                vient de lui être envoyée.
              </p>
            )}
          </div>
          <Button type="submit" disabled={adding}>
            {adding ? <Loader2 className="size-4 animate-spin" /> : "Ajouter"}
          </Button>
        </form>

        <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
          {members === null ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Chargement…</p>
          ) : members.length === 0 && invites.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Aucun collaborateur pour l&apos;instant.
            </p>
          ) : (
            <StaggerContainer className="flex flex-col gap-1">
              {invites.map((invite) => (
                <StaggerItem key={`invite-${invite.email}`}>
                  <div className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-accent">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground ring-2 ring-card">
                      <Mail className="size-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{invite.email}</p>
                      <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <Clock className="size-3" />
                        Invitation envoyée, en attente d&apos;inscription
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={`Annuler l'invitation de ${invite.email}`}
                      onClick={() => handleCancelInvite(invite.email)}
                      disabled={cancelingInvite === invite.email}
                      className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      {cancelingInvite === invite.email ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <X className="size-3.5" />
                      )}
                    </button>
                  </div>
                </StaggerItem>
              ))}
              {members?.map((member) => (
                <StaggerItem key={member.user_id}>
                  <div className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-accent">
                    <Avatar member={member} className="ring-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{member.name || member.email}</p>
                      {member.name && (
                        <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                      )}
                    </div>
                    <div
                      role="radiogroup"
                      aria-label={`Rôle de ${member.email}`}
                      className="flex shrink-0 items-center gap-0.5 rounded-full border bg-muted/50 p-0.5"
                    >
                      <button
                        type="button"
                        role="radio"
                        aria-checked={member.role === "read"}
                        onClick={() => handleRoleChange(member.user_id, "read")}
                        disabled={updatingRoleId === member.user_id || member.role === "read"}
                        className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
                          member.role === "read"
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Eye className="size-3" />
                        Lecture
                      </button>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={member.role === "owner"}
                        onClick={() => handleRoleChange(member.user_id, "owner")}
                        disabled={updatingRoleId === member.user_id || member.role === "owner"}
                        className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
                          member.role === "owner"
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {updatingRoleId === member.user_id ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <Crown className="size-3" />
                        )}
                        Owner
                      </button>
                    </div>
                    <button
                      type="button"
                      aria-label={`Retirer ${member.email}`}
                      onClick={() => handleRemove(member.user_id)}
                      disabled={removingId === member.user_id}
                      className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      {removingId === member.user_id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <X className="size-3.5" />
                      )}
                    </button>
                  </div>
                </StaggerItem>
              ))}
            </StaggerContainer>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
