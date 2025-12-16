import NextAuth from "next-auth";

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



