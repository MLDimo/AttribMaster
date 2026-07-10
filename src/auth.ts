import NeonAdapter from "@auth/neon-adapter";
import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

import { getDbPool } from "@/lib/db/client";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: NeonAdapter(getDbPool()),
  // Le provider Credentials n'est pas compatible avec les sessions "database" ;
  // on passe donc en JWT (l'adapter reste utilisé pour persister users/accounts
  // pour le login Google, mais la table `sessions` n'est plus utilisée).
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }

        const pool = getDbPool();
        const { rows } = await pool.query(
          `select id, name, email, password_hash from users where email = $1`,
          [email]
        );
        const user = rows[0];
        if (!user?.password_hash) {
          return null;
        }

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
          return null;
        }

        return { id: user.id, name: user.name, email: user.email };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (token?.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
