"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { PageLoadingSpinner } from "@/components/scriba/ui/PageLoadingSpinner";
import { setClientStorageScope } from "@/lib/utils/storageScope";

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(normalized);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function getGroupIdFromDest(dest: string): string | null {
  const match = dest.match(/^\/group\/([^/?#]+)/);
  return match?.[1] || null;
}

function LtiLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("token");
    const dest = searchParams.get("dest") || "/";

    if (!token) {
      router.replace("/auth/signin");
      return;
    }

    const payload = decodeJwtPayload(token);
    setClientStorageScope({
      userId: typeof payload?.userId === "string" ? payload.userId : null,
      groupId: getGroupIdFromDest(dest),
    });

    signIn("lti", { ltiToken: token, redirect: false }).then((result) => {
      if (result?.ok) {
        router.replace(dest);
      } else {
        router.replace("/auth/signin");
      }
    });
  }, [router, searchParams]);

  return <PageLoadingSpinner text="Signing in..." fullPage={true} />;
}

export default function LtiLoginPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner text="Signing in..." fullPage={true} />}>
      <LtiLoginContent />
    </Suspense>
  );
}
