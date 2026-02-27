import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getGameById, removeCollaborator } from "@/app/api/_lib/services/gameService";
import { getUserByEmail } from "@/app/api/_lib/services/userService";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; email: string }> },
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const actorIdentifiers = [session.userId, session.user.email].filter(Boolean) as string[];
  const { id, email } = await params;
  const collaboratorEmail = decodeURIComponent(email).trim().toLowerCase();

  const game = await getGameById(id, actorIdentifiers);
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  if (!game.can_remove_collaborators) {
    return NextResponse.json({ error: "Only original creator can remove collaborators" }, { status: 403 });
  }

  const ownerUser = game.user_id.includes("@") ? { email: game.user_id } : await getUserByEmail(game.user_id);
  if (ownerUser?.email?.toLowerCase() === collaboratorEmail) {
    return NextResponse.json({ error: "Original creator cannot be removed" }, { status: 400 });
  }

  const removed = await removeCollaborator(id, collaboratorEmail);
  return NextResponse.json({ success: removed });
}
