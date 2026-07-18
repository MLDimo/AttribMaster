import NeonAdapter from "@auth/neon-adapter";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

import { verifyCredentials } from "@/lib/auth/credentials";
import { getDbPool } from "@/lib/db/client";

export const { handlers, auth } = NextAuth({
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
      // Google vérifie toujours l'email : on autorise le lien automatique avec
      // un compte existant (créé via email/mot de passe) ayant le même email.
      allowDangerousEmailAccountLinking: true,
    }),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        return verifyCredentials(credentials?.email, credentials?.password);
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // Si quelqu'un se connecte via Google sur un compte email/mot de passe
      // jamais vérifié, ce mot de passe a été posé par quelqu'un qui n'a
      // jamais prouvé posséder l'adresse (pré-enregistrement malveillant
      // possible) : on le purge au moment où le vrai propriétaire — vérifié
      // par Google — prend la main sur le compte.
      if (account?.provider === "google" && user.email) {
        await getDbPool().query(
          `update users set password_hash = null
           where lower(email) = lower($1) and "emailVerified" is null and password_hash is not null`,
          [user.email]
        );
      }
      return true;
    },
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
