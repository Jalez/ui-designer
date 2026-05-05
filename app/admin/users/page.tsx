"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Shield, ShieldAlert, ShieldCheck, UserRound } from "lucide-react";
import { PageContainer } from "@/components/scriba/ui/PageContainer";
import { checkAdminStatus } from "@/components/default/user/utils/admin";
import { apiUrl } from "@/lib/apiUrl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

type AdminUserRecord = {
  id: string;
  email: string;
  name: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  isAdmin: boolean;
  adminRole: string | null;
  grantedAt: string | null;
  grantedByEmail: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "Unknown";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown";
  return parsed.toLocaleString();
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(apiUrl("/api/admin/users"));
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Failed to load users");
      }
      setUsers(Array.isArray(payload.users) ? payload.users : []);
      setCurrentUserId(payload.currentUserId ?? null);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load users");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    checkAdminStatus().then((isAdmin) => {
      if (cancelled) return;
      if (!isAdmin) {
        router.replace("/help");
        return;
      }
      setAllowed(true);
      void loadUsers();
    });
    return () => {
      cancelled = true;
    };
  }, [loadUsers, router]);

  const filteredUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) {
      return users;
    }
    return users.filter((user) => {
      return (
        user.email.toLowerCase().includes(normalizedSearch) ||
        (user.name ?? "").toLowerCase().includes(normalizedSearch)
      );
    });
  }, [search, users]);

  const handleAdminToggle = useCallback(
    async (user: AdminUserRecord) => {
      try {
        setPendingUserId(user.id);
        setError(null);
        const response = await fetch(apiUrl("/api/admin/users"), {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId: user.id,
            makeAdmin: !user.isAdmin,
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error || "Failed to update admin access");
        }
        await loadUsers();
      } catch (toggleError) {
        setError(toggleError instanceof Error ? toggleError.message : "Failed to update admin access");
      } finally {
        setPendingUserId(null);
      }
    },
    [loadUsers],
  );

  if (allowed === null) {
    return (
      <PageContainer className="h-full overflow-y-auto">
        <div className="max-w-5xl mx-auto py-10 px-4 flex items-center justify-center min-h-[200px]">
          <p className="text-muted-foreground">Checking access...</p>
        </div>
      </PageContainer>
    );
  }

  if (!allowed) {
    return null;
  }

  return (
    <PageContainer className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto py-10 px-4 space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground">
            View all users and grant or revoke admin access.
          </p>
        </header>

        <Card>
          <CardHeader className="gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle>Users</CardTitle>
              <CardDescription>
                Admins can view every user account and manage admin privileges.
              </CardDescription>
            </div>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name or email"
              className="sm:max-w-xs"
            />
          </CardHeader>
          <CardContent className="space-y-3">
            {error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            {isLoading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading users...
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No users found.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredUsers.map((user) => {
                  const isSelf = currentUserId === user.id;
                  const isPending = pendingUserId === user.id;

                  return (
                    <div
                      key={user.id}
                      className="flex flex-col gap-3 rounded-lg border bg-card px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="inline-flex items-center gap-2 font-medium">
                            <UserRound className="h-4 w-4 text-muted-foreground" />
                            <span className="truncate">{user.name || user.email}</span>
                          </div>
                          {user.isAdmin ? (
                            <Badge variant="default" className="gap-1">
                              <ShieldCheck className="h-3 w-3" />
                              {user.adminRole || "admin"}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1">
                              <Shield className="h-3 w-3" />
                              user
                            </Badge>
                          )}
                          {isSelf && (
                            <Badge variant="outline">You</Badge>
                          )}
                        </div>
                        <div className="truncate text-sm text-muted-foreground">{user.email}</div>
                        <div className="text-xs text-muted-foreground">
                          Created {formatDate(user.createdAt)}
                          {user.isAdmin && user.grantedAt
                            ? ` • Admin since ${formatDate(user.grantedAt)}${user.grantedByEmail ? ` by ${user.grantedByEmail}` : ""}`
                            : ""}
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant={user.isAdmin ? "outline" : "default"}
                        className="shrink-0 gap-2"
                        disabled={isPending || isSelf}
                        onClick={() => void handleAdminToggle(user)}
                        title={isSelf ? "You cannot change your own admin access here" : undefined}
                      >
                        {isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : user.isAdmin ? (
                          <ShieldAlert className="h-4 w-4" />
                        ) : (
                          <ShieldCheck className="h-4 w-4" />
                        )}
                        {user.isAdmin ? "Remove admin" : "Make admin"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
