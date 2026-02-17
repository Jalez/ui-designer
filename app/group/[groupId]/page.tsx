import { redirect, notFound } from "next/navigation";
import { Suspense } from "react";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getLtiSession } from "@/lib/lti/session";
import { getSql } from "@/app/api/_lib/db";
import { GroupGameClient } from "@/components/GroupGameClient";
import { logDebug } from "@/lib/debug-logger";

export const dynamic = "force-dynamic";

export default async function GroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const { groupId } = await params;
  const { mode } = await searchParams;

  const session = await getServerSession(authOptions);
  const ltiSession = await getLtiSession();

  if (ltiSession && mode !== "game") {
    redirect(`/group/${groupId}?mode=game`);
  }

  logDebug("group_page_session", {
    groupId,
    sessionUserEmail: session?.user?.email,
    sessionUserId: session?.userId,
    ltiSessionUserId: ltiSession?.userId,
    ltiSessionUserEmail: ltiSession?.userEmail,
    mode,
  });

  if (!session?.user && !ltiSession) {
    redirect("/auth/signin");
  }

  const user = session?.user
    ? {
        id: session.userId || session.user.email || "",
        email: session.user.email || "",
        name: session.user.name ?? undefined,
        image: session.user.image ?? undefined,
      }
    : {
        id: ltiSession!.userId,
        email: ltiSession!.userEmail,
        name: ltiSession!.userName || undefined,
        image: undefined,
      };

  logDebug("group_page_resolved_user", {
    userId: user.id,
    userEmail: user.email,
    userName: user.name,
  });

  const sql = await getSql();

  // Verify the group exists
  const groupResult = await sql.query(
    "SELECT id, name FROM groups WHERE id = $1",
    [groupId]
  );
  const groupRows = (groupResult as any).rows ?? groupResult;
  if (!groupRows?.length) notFound();

  // Get or create the shared game for this group
  const existingResult = await sql.query(
    "SELECT id FROM projects WHERE group_id = $1 ORDER BY created_at ASC LIMIT 1",
    [groupId]
  );
  const existingRows = (existingResult as any).rows ?? existingResult;

  let gameId: string;

  if (existingRows?.length) {
    gameId = existingRows[0].id;
  } else {
    // Create the group's shared game
    const created = await sql.query(
      `INSERT INTO projects (user_id, map_name, title, progress_data, group_id)
       VALUES ($1, 'all', $2, '{}', $3)
       RETURNING id`,
      [user.id, groupRows[0].name, groupId]
    );
    const createdRows = (created as any).rows ?? created;
    gameId = createdRows[0].id;
  }

  logDebug("group_page_render", {
    groupId,
    gameId,
    passedUserId: user.id,
    passedUserEmail: user.email,
  });

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
        </div>
      }
    >
      <GroupGameClient groupId={groupId} gameId={gameId} user={user} />
    </Suspense>
  );
}
