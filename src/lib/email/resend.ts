/**
 * Envoi d'email transactionnel via l'API REST Resend (pas de SDK). Lève si
 * l'envoi échoue ; c'est à l'appelant de décider si c'est bloquant. Activé
 * uniquement si RESEND_API_KEY est présent (voir hasEmailSending).
 */
export function hasEmailSending(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/**
 * À appliquer à TOUTE valeur non littérale insérée dans le HTML d'un email.
 *
 * Les corps de mail sont des template strings : un nom de projet ou un nom
 * d'utilisateur y arrive tel quel. Sans échappement, un membre d'un workspace
 * peut renommer un projet en `<a href="...">` et faire partir ce lien dans
 * l'email d'alerte reçu par les OWNERS — une injection qui traverse les
 * utilisateurs, pas seulement l'auteur.
 */
export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function sendEmail(to: string[], subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set");
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.ALERT_FROM_EMAIL ?? "AttribMaster <alerts@attribmaster.com>",
      to,
      subject,
      html,
    }),
  });
  if (!res.ok) {
    throw new Error(`Resend API error ${res.status}: ${await res.text()}`);
  }
}
