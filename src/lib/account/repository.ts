import { auth } from "@/auth";
import { getDbPool } from "@/lib/db/client";
import type { MyAccountInfo } from "./types";

export async function getMyAccountInfo(): Promise<MyAccountInfo> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const db = getDbPool();
  const { rows } = await db.query<{ name: string | null; email: string | null; image: string | null }>(
    `select name, email, image from users where id = $1`,
    [session.user.id]
  );
  const user = rows[0];

  const { rows: linkedRows } = await db.query(
    `select 1 from accounts where "userId" = $1 and provider = 'google'`,
    [session.user.id]
  );

  return {
    id: session.user.id,
    name: user?.name ?? null,
    email: user?.email ?? null,
    image: user?.image ?? null,
    googleLinked: linkedRows.length > 0,
  };
}
