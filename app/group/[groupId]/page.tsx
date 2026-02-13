"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { CollaborationProvider } from "@/lib/collaboration";
import { ConnectionStatus, UserPresence } from "@/components/collaboration";
import { InviteToGroupDialog } from "@/components/groups";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface GroupData {
  group: {
    id: string;
    name: string;
  };
  members: Array<{
    id: string;
    userId: string;
    role: string;
  }>;
}

export default function GroupPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = use(params);
  const router = useRouter();
  const { data: session, status } = useSession();
  const [groupData, setGroupData] = useState<GroupData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGroup = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/groups/${groupId}`);

        if (!response.ok) {
          if (response.status === 401) {
            router.push("/auth/signin");
            return;
          }
          if (response.status === 403) {
            setError("You don't have access to this group");
            return;
          }
          throw new Error("Failed to fetch group");
        }

        const data = await response.json();
        setGroupData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load group");
      } finally {
        setIsLoading(false);
      }
    };

    if (status !== "loading") {
      fetchGroup();
    }
  }, [groupId, status, router]);

  if (status === "loading" || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive">{error}</p>
            <Button className="mt-4" onClick={() => router.push("/")}>
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!session?.user) {
    router.push("/auth/signin");
    return null;
  }

  const user = {
    id: session.userId || session.user?.email || "",
    email: session.user?.email || "",
    name: session.user?.name || undefined,
    image: session.user?.image || undefined,
  };

  return (
    <CollaborationProvider groupId={groupId} user={user}>
      <div className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between border-b px-4 py-2">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold">{groupData?.group.name || "Group"}</h1>
            <ConnectionStatus />
            <UserPresence />
          </div>
          <div className="flex items-center gap-2">
            <InviteToGroupDialog
              groupId={groupId}
              onMemberAdded={() => {
                fetch(`/api/groups/${groupId}`)
                  .then((res) => res.json())
                  .then(setGroupData);
              }}
              trigger={<Button variant="outline" size="sm">Invite</Button>}
            />
          </div>
        </header>
        <main className="flex-1">
          <div className="flex h-full items-center justify-center p-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold">Collaborative Game</h2>
              <p className="mt-2 text-muted-foreground">
                Group collaboration is active. You can see other users&apos; cursors in real-time.
              </p>
              <p className="mt-4 text-sm text-muted-foreground">
                Members: {groupData?.members.length || 0}
              </p>
            </div>
          </div>
        </main>
      </div>
    </CollaborationProvider>
  );
}
