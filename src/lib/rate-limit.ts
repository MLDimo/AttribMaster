import { NextRequest } from "next/server";

import { getDbPool } from "@/lib/db/client";

/**
 * Rate limiting générique par clé (compteur en base, fenêtre fixe qui repart
 * à zéro quand elle expire) : suffisant contre le spam de formulaires
 * publics, sans dépendance externe. Retourne true si la requête est admise.
 */
export async function checkRateLimit(
  key: string,
  maxPerWindow: number,
  windowMinutes: number
): Promise<boolean> {
  const db = getDbPool();
  const { rows } = await db.query<{ count: number }>(
    `insert into rate_limits (key, count, window_start)
     values ($1, 1, now())
     on conflict (key) do update set
       count = case
         when rate_limits.window_start < now() - make_interval(mins => $2) then 1
         else rate_limits.count + 1
       end,
       window_start = case
         when rate_limits.window_start < now() - make_interval(mins => $2) then now()
         else rate_limits.window_start
       end
     returning count`,
    [key, windowMinutes]
  );
  return (rows[0]?.count ?? Infinity) <= maxPerWindow;
}

/** IP du client derrière le proxy Vercel (première entrée de x-forwarded-for). */
export function clientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
