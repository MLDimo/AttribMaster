/**
 * Envoi d'email transactionnel via l'API REST Resend (pas de SDK). Lève si
 * l'envoi échoue ; c'est à l'appelant de décider si c'est bloquant. Activé
 * uniquement si RESEND_API_KEY est présent (voir hasEmailSending).
 */
export function hasEmailSending(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
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
