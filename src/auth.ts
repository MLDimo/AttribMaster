import NeonAdapter from "@auth/neon-adapter";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

import { getDbPool } from "@/lib/db/client";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: NeonAdapter(getDbPool()),
  session: { strategy: "database" },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
});
