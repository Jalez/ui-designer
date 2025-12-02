import { getServerSession } from "next-auth/next";
import { Suspense } from "react";
import { isAdmin } from "@/app/api/_lib/services/adminService";
import { PageSkeleton } from "@/components/scriba/ui/PageSkeleton";
import { authOptions } from "@/lib/auth";
import SubscriptionPageClient from "./client";

export default async function subscriptionPage() {
  // Server-side admin check
  const session = await getServerSession(authOptions);
  let isAdminUser = false;

  if (session?.user?.email) {
    try {
      isAdminUser = await isAdmin(session.userId);
    } catch (error) {
      console.error("Error checking admin status:", error);
      isAdminUser = false;
    }
  }

  return (
    <Suspense fallback={<PageSkeleton type="subscription" />}>
      <SubscriptionPageClient isAdmin={isAdminUser} />  
    </Suspense>
  );
}
