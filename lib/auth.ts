import type { Session } from "next-auth";
import NextAuth from "next-auth/next";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import jwt from "jsonwebtoken";
import { getOrCreateUserByEmail } from "@/app/api/_lib/services/userService";
import { logDebug } from "@/lib/debug-logger";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuid = (value?: string) => !!value && UUID_RE.test(value);

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
    // LTI credentials provider — accepts a short-lived signed JWT issued by /api/lti/launch
    CredentialsProvider({
      id: "lti",
      name: "LTI",
      credentials: { ltiToken: { type: "text" } },
      async authorize(credentials) {
        if (!credentials?.ltiToken) {
          logDebug("lti_auth_no_token", {});
          return null;
        }
        try {
          const payload = jwt.verify(
            credentials.ltiToken,
            process.env.NEXTAUTH_SECRET!,
            { issuer: "lti-launch" }
          ) as { userId: string; email: string; name?: string };

          logDebug("lti_auth_verify", {
            jwtUserId: payload.userId,
            jwtEmail: payload.email,
            jwtName: payload.name,
          });

          if (!payload.userId || !payload.email) return null;
          return { id: payload.userId, email: payload.email, name: payload.name || null };
        } catch (error) {
          logDebug("lti_auth_error", { error: String(error) });
          return null;
        }
      },
    }),
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
        logDebug("jwt_callback_account", {
          provider: account.provider,
          hasAccessToken: !!account.access_token,
          userEmail: user?.email,
        });
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
        token.scope = account.scope;
      }

      // Preserve provider-resolved user ID when available (e.g. LTI credentials sign-in)
      if (user?.id) {
        token.userId = user.id;
      }

      // Always normalize to internal DB UUID when possible.
      // Provider IDs (e.g. Google subject) are not UUIDs and break DB queries.
      if ((!isUuid(token.userId as string | undefined) || !token.userId) && token.email) {
        try {
          const dbUser = await getOrCreateUserByEmail(token.email as string);
          token.userId = dbUser.id;
          logDebug("jwt_callback_normalized_user", {
            tokenEmail: token.email,
            normalizedUserId: dbUser.id,
          });
        } catch (error) {
          logDebug("jwt_callback_normalize_error", { error: String(error) });
        }
      }

      // Fallback: resolve internal user ID from email
      if (!token.userId && token.email) {
        try {
          const dbUser = await getOrCreateUserByEmail(token.email as string);
          token.userId = dbUser.id;
          logDebug("jwt_callback_user", {
            tokenEmail: token.email,
            dbUserId: dbUser.id,
            dbUserEmail: dbUser.email,
          });
        } catch (error) {
          logDebug("jwt_callback_error", { error: String(error) });
        }
      }

      return token;
    },
    async session({ session, token }) {
      // Send properties to the client
      session.accessToken = token.accessToken;
      session.scope = token.scope;
      session.userId = token.userId;

      logDebug("session_callback", {
        sessionEmail: session.user?.email,
        tokenUserId: token.userId,
        sessionUserId: session.userId,
      });

      return session;
    },
    async signIn({ user, account, profile, email, credentials }) {
      logDebug("signin_callback", {
        userEmail: user.email,
        userName: user.name,
        provider: account?.provider,
      });

      // Create or get user record with internal UUID
      if (user.email) {
        try {
          const userRecord = await getOrCreateUserByEmail(user.email);
          logDebug("signin_user_record", {
            userId: userRecord.id,
            email: userRecord.email,
          });
        } catch (error) {
          logDebug("signin_error", { error: String(error) });
          return false; // Deny sign in if we can't create user record
        }
      }

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






