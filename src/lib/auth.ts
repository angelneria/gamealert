import NextAuth from "next-auth";
import { authConfig } from "@/config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: authConfig.secret,
  providers: [
    // Email provider
    // In production, add EmailProvider or CredentialsProvider
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        (session.user as any).id = token.id;
      }
      return session;
    },
  },
  pages: {
    signIn: "/register",
  },
});

export const authOptions = {
  secret: authConfig.secret,
  providers: [],
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }: any) {
      if (token) {
        (session.user as any).id = token.id;
      }
      return session;
    },
  },
  pages: {
    signIn: "/register",
  },
};
