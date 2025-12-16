import type { Session } from "next-auth";
import NextAuth from "next-auth/next";
import GoogleProvider from "next-auth/providers/google";
import { getOrCreateUserByEmail } from "@/app/api/_lib/services/userService";

// Extend the Session type to include userId
declare module "next-auth" {
  interface Session {
    userId?: string;
    accessToken?: string;
    scope?: string;
  }

  interface JWT {
    userId?: string;
    accessToken?: string;
    scope?: string;
  }
}

// Export the properly typed session for use in API routes
export type AuthSession = Session;

export const authOptions = {
  session: {
    strategy: "jwt" as const,
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 24 hours
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: [
            "openid",
            "email",
            "profile",
            //"https://www.googleapis.com/auth/drive",
            //"https://www.googleapis.com/auth/drive.file",
            //"https://www.googleapis.com/auth/drive.readonly",
          ].join(" "),
          prompt: "consent",
          access_type: "offline",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, user, profile, trigger, isNewUser, session }) {
      // Persist the OAuth access_token to the token right after signin
      if (account) {
        console.log("JWT callback: Account received", {
          hasAccessToken: !!account.access_token,
          hasRefreshToken: !!account.refresh_token,
          expiresAt: account.expires_at,
          scope: account.scope,
        });
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
        token.scope = account.scope;
      }

      // Add internal user ID to token
      if (token.email) {
        try {
          const dbUser = await getOrCreateUserByEmail(token.email);
          token.userId = dbUser.id;
        } catch (error) {
          console.error("JWT callback: Failed to get/create user", error);
        }
      }

      return token;
    },
    async session({ session, token }) {
      // Send properties to the client
      session.accessToken = token.accessToken;
      session.scope = token.scope;
      session.userId = token.userId;
      return session;
    },
    async signIn({ user, account, profile, email, credentials }) {
      console.log("SignIn callback:", {
        userEmail: user.email,
        provider: account?.provider,
        hasAccessToken: !!account?.access_token,
        scope: account?.scope,
      });

      // Create or get user record with internal UUID
      if (user.email) {
        try {
          const userRecord = await getOrCreateUserByEmail(user.email);
          console.log("SignIn callback: User record created/found", {
            userId: userRecord.id,
            email: userRecord.email
          });
        } catch (error) {
          console.error("SignIn callback: Failed to create/get user record", error);
          return false; // Deny sign in if we can't create user record
        }
      }

      // Note: Document claiming is handled client-side after successful sign-in
      // This is because we need access to the anonymous session ID from localStorage

      return true;
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error", // Use dedicated error page
  },
  debug: process.env.NODE_ENV === "development",
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };




