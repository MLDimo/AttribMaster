/**
 * Habillage HTML/CSS commun à tous les emails transactionnels : reprend la
 * palette "nude" du site (voir `src/app/globals.css`, mode jour uniquement —
 * un email ne suit pas le thème sombre du destinataire) et le nom du site en
 * en-tête. Styles 100% inline (pas de <style> ni de classes Tailwind) : les
 * webmails (Gmail, Outlook...) suppriment ou ignorent souvent les balises
 * <style>, l'inline est la seule approche fiable en email.
 *
 * ATTENTION : `bodyHtml` est injecté tel quel (pas d'échappement ici) — c'est
 * à l'appelant d'échapper toute valeur non littérale avec `escapeHtml` avant
 * de construire ce HTML, exactement comme pour les emails qui n'utilisent pas
 * ce layout (voir le commentaire dans resend.ts).
 */

const COLORS = {
  background: "#faf5ee",
  card: "#fffdf9",
  foreground: "#3c2e22",
  mutedForeground: "#8a7967",
  border: "#ede0d2",
  primary: "#8a4b2e",
  primaryForeground: "#fff8f0",
  brandAccent: "#c08a3e",
} as const;

const FONT_STACK =
  "'Fira Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export function renderEmailLayout(bodyHtml: string, preheader?: string): string {
  return `
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>AttribMaster</title>
  </head>
  <body style="margin:0;padding:0;background-color:${COLORS.background};font-family:${FONT_STACK};">
    ${
      preheader
        ? `<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;">${preheader}</div>`
        : ""
    }
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLORS.background};">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:${COLORS.card};border:1px solid ${COLORS.border};border-radius:16px;">
            <tr>
              <td style="padding:28px 40px;border-bottom:1px solid ${COLORS.border};">
                <span style="font-family:${FONT_STACK};font-size:20px;font-weight:700;letter-spacing:-0.01em;color:${COLORS.primary};">
                  Attrib<span style="color:${COLORS.brandAccent};">Master</span>
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 40px;font-family:${FONT_STACK};font-size:15px;line-height:1.6;color:${COLORS.foreground};">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 40px 28px 40px;border-top:1px solid ${COLORS.border};">
                <p style="margin:0;font-family:${FONT_STACK};font-size:12px;line-height:1.5;color:${COLORS.mutedForeground};">
                  AttribMaster — Devenez maître de votre attribution marketing.<br />
                  <a href="https://attribmaster.com" style="color:${COLORS.mutedForeground};">attribmaster.com</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`.trim();
}

/** Bouton d'appel à l'action, cohérent avec les boutons "pill" (rounded-full) du produit. */
export function renderEmailButton(label: string, url: string): string {
  return `<a href="${url}" style="display:inline-block;background-color:${COLORS.primary};color:${COLORS.primaryForeground};font-family:${FONT_STACK};font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:9999px;">${label}</a>`;
}
