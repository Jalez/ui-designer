import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { addCollaborator, getGameById, listCollaborators } from "@/app/api/_lib/services/gameService";
import { getUserByEmail } from "@/app/api/_lib/services/userService";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const actorIdentifiers = [session.userId, session.user.email].filter(Boolean) as string[];
  const { id } = await params;

  const game = await getGameById(id, actorIdentifiers);
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  if (!game.can_edit) {
    return NextResponse.json({ error: "No access" }, { status: 403 });
  }

  const collaborators = await listCollaborators(id);

  return NextResponse.json({
    ownerUserId: game.user_id,
    canManageCollaborators: Boolean(game.can_manage_collaborators),
    canRemoveCollaborators: Boolean(game.can_remove_collaborators),
    collaborators,
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const actorIdentifiers = [session.userId, session.user.email].filter(Boolean) as string[];
  const actorId = (session.userId || session.user.email) as string;
  const { id } = await params;

  const game = await getGameById(id, actorIdentifiers);
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  if (!game.can_manage_collaborators) {
    return NextResponse.json({ error: "Only creators can add collaborators" }, { status: 403 });
  }

  const body = await request.json();
  const email = String(body.email || "").trim().toLowerCase();

  if (!EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: "Valid collaborator email is required" }, { status: 400 });
  }

  const ownerUser = game.user_id.includes("@") ? { email: game.user_id } : await getUserByEmail(game.user_id);
  if (ownerUser?.email?.toLowerCase() === email) {
    return NextResponse.json({ error: "Original creator already has access" }, { status: 400 });
  }

  await addCollaborator(id, email, actorId);

  const collaborators = await listCollaborators(id);
  return NextResponse.json({ success: true, collaborators });
}
