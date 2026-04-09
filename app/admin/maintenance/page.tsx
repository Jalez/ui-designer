"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageContainer } from "@/components/scriba/ui/PageContainer";
import { checkAdminStatus } from "@/components/default/user/utils/admin";
import { PurgeOrphanLevelsCard } from "@/components/default/help/PurgeOrphanLevelsCard";
import { PurgeOrphanMapsCard } from "@/components/default/help/PurgeOrphanMapsCard";

export default function AdminMaintenancePage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    checkAdminStatus().then((isAdmin) => {
      if (cancelled) return;
      if (!isAdmin) {
        router.replace("/help");
        return;
      }
      setAllowed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (allowed === null) {
    return (
      <PageContainer className="h-full overflow-y-auto">
        <div className="max-w-4xl mx-auto py-10 px-4 flex items-center justify-center min-h-[200px]">
          <p className="text-muted-foreground">Checking access…</p>
        </div>
      </PageContainer>
    );
  }

  if (!allowed) {
    return null;
  }

  return (
    <PageContainer className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto py-10 px-4 space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">Maintenance</h1>
          <p className="text-muted-foreground">
            Purge orphan levels and maps that are not attached to any game. Admin only.
          </p>
        </header>
        <div className="space-y-4">
          <PurgeOrphanMapsCard />
          <PurgeOrphanLevelsCard />
        </div>
      </div>
    </PageContainer>
  );
}
