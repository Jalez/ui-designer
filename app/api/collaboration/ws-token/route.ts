import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import jwt from "jsonwebtoken";
import { authOptions } from "@/lib/auth";
import { getGameById, getGameByIdForGameplay, evaluateGameRouteAccess } from "@/app/api/_lib/services/gameService";
import { getOrCreateUserByEmail } from "@/app/api/_lib/services/userService";
import { getGroupById, isGroupMember } from "@/app/api/_lib/services/groupService";
import { resolveAccessKeyForGame } from "@/app/api/_lib/services/gameService/accessCookie";

type ParsedRoom =
  | { kind: "creator"; roomId: string; gameId: string; mapName: string }
  | { kind: "instance"; roomId: string; gameId: string; groupId: string | null; userId: string | null }
  | { kind: "lobby"; roomId: string; gameId: string; scope: string };

function getWsAuthSecret(): string {
  const secret =
    process.env.WS_AUTH_SECRET
    || process.env.NEXTAUTH_SECRET
    || (process.env.NODE_ENV !== "production" ? "ws-auth-secret" : "");
  if (!secret) {
    throw new Error("WS auth secret is not configured");
  }
  return secret;
}

function parseRoomId(roomId: string): ParsedRoom | null {
  const creatorMatch = roomId.match(/^creator:(.+?):map:(.+)$/);
  if (creatorMatch) {
    return {
      kind: "creator",
      roomId,
      gameId: creatorMatch[1],
      mapName: decodeURIComponent(creatorMatch[2]),
    };
  }

  const groupMatch = roomId.match(/^group:(.+?):game:(.+)$/);
  if (groupMatch) {
    return {
      kind: "instance",
      roomId,
      gameId: groupMatch[2],
      groupId: groupMatch[1],
      userId: null,
    };
  }

  const individualMatch = roomId.match(/^individual:(.+?):game:(.+)$/);
  if (individualMatch) {
    return {
      kind: "instance",
      roomId,
      gameId: individualMatch[2],
      groupId: null,
      userId: individualMatch[1],
    };
  }

  const lobbyMatch = roomId.match(/^lobby:(.+):game:(.+)$/);
  if (lobbyMatch) {
    return {
      kind: "lobby",
      roomId,
      scope: decodeURIComponent(lobbyMatch[1]),
      gameId: lobbyMatch[2],
    };
  }

  return null;
}

function accessDenied(reason: "not_started" | "expired" | "access_key_required" | "access_key_invalid") {
  if (reason === "not_started") {
    return NextResponse.json({ error: "Game is not open yet" }, { status: 403 });
  }
  if (reason === "expired") {
    return NextResponse.json({ error: "Game access windows have ended" }, { status: 403 });
  }
  return NextResponse.json(
    { error: reason === "access_key_invalid" ? "Invalid access key" : "Access key required" },
    { status: 403 }
  );
}

function issueToken(claims: {
  roomId: string;
  gameId: string;
  userId: string;
  userEmail: string;
  userName?: string;
  userImage?: string;
  accountUserId: string;
  accountUserEmail: string;
  authKind: "session" | "guest";
}) {
  const secret = getWsAuthSecret();
  return jwt.sign(
    claims,
    secret,
    {
      issuer: "ws-auth",
      audience: "ws-server",
      expiresIn: "5m",
      subject: claims.userId,
    }
  );
}

export async function POST(request: NextRequest) {
  let body: { roomId?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const roomId = typeof body.roomId === "string" ? body.roomId : "";
  if (!roomId) {
    return NextResponse.json({ error: "roomId is required" }, { status: 400 });
  }

  const room = parseRoomId(roomId);
  if (!room) {
    return NextResponse.json({ error: "Invalid roomId" }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  const actorIdentifiers = session?.user?.email
    ? [session.userId, session.user.email].filter(Boolean) as string[]
    : [];

  if (room.kind === "creator") {
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const game = await getGameById(room.gameId, actorIdentifiers);
    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }
    if (!game.can_edit) {
      return NextResponse.json({ error: "No edit access for this game" }, { status: 403 });
    }

    const userRecord = await getOrCreateUserByEmail(session.user.email);
    const token = issueToken({
      roomId,
      gameId: room.gameId,
      userId: userRecord.id,
      userEmail: session.user.email,
      userName: session.user.name ?? undefined,
      userImage: session.user.image ?? undefined,
      accountUserId: userRecord.id,
      accountUserEmail: session.user.email,
      authKind: "session",
    });
    return NextResponse.json({ token });
  }

  const game = await getGameByIdForGameplay(room.gameId, actorIdentifiers.length ? actorIdentifiers : undefined);
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  const accessError = evaluateGameRouteAccess(game, resolveAccessKeyForGame(request, game));
  if (accessError) {
    return accessDenied(accessError);
  }

  if (room.kind === "lobby") {
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Authentication required for group games" }, { status: 401 });
    }
    if (game.collaboration_mode !== "group") {
      return NextResponse.json({ error: "Lobby tokens are only valid for group games" }, { status: 403 });
    }

    const userRecord = await getOrCreateUserByEmail(session.user.email);
    const token = issueToken({
      roomId,
      gameId: room.gameId,
      userId: userRecord.id,
      userEmail: session.user.email,
      userName: session.user.name ?? undefined,
      userImage: session.user.image ?? undefined,
      accountUserId: userRecord.id,
      accountUserEmail: session.user.email,
      authKind: "session",
    });
    return NextResponse.json({ token });
  }

  if (room.groupId) {
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Authentication required for group games" }, { status: 401 });
    }
    if (game.collaboration_mode !== "group") {
      return NextResponse.json({ error: "Requested room does not match game collaboration mode" }, { status: 403 });
    }

    const userRecord = await getOrCreateUserByEmail(session.user.email);
    if (game.can_edit) {
      const group = await getGroupById(room.groupId);
      if (!group) {
        return NextResponse.json({ error: "Group not found" }, { status: 404 });
      }
    } else {
      const member = await isGroupMember(room.groupId, userRecord.id);
      if (!member) {
        return NextResponse.json({ error: "You are not a member of this group" }, { status: 403 });
      }
    }

    const token = issueToken({
      roomId,
      gameId: room.gameId,
      userId: userRecord.id,
      userEmail: session.user.email,
      userName: session.user.name ?? undefined,
      userImage: session.user.image ?? undefined,
      accountUserId: userRecord.id,
      accountUserEmail: session.user.email,
      authKind: "session",
    });
    return NextResponse.json({ token });
  }

  const roomUserId = room.userId || "";
  if (!roomUserId) {
    return NextResponse.json({ error: "Invalid individual room" }, { status: 400 });
  }

  if (session?.user?.email) {
    const userRecord = await getOrCreateUserByEmail(session.user.email);
    if (roomUserId !== userRecord.id && !game.can_edit) {
      return NextResponse.json({ error: "No access to this individual room" }, { status: 403 });
    }

    const token = issueToken({
      roomId,
      gameId: room.gameId,
      userId: userRecord.id,
      userEmail: session.user.email,
      userName: session.user.name ?? undefined,
      userImage: session.user.image ?? undefined,
      accountUserId: userRecord.id,
      accountUserEmail: session.user.email,
      authKind: "session",
    });
    return NextResponse.json({ token });
  }

  if (game.collaboration_mode === "group") {
    return NextResponse.json({ error: "Authentication required for group games" }, { status: 401 });
  }

  if (!game.is_public) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const token = issueToken({
    roomId,
    gameId: room.gameId,
    userId: roomUserId,
    userEmail: `guest-${roomUserId}@local`,
    userName: "Guest",
    accountUserId: roomUserId,
    accountUserEmail: `guest-${roomUserId}@local`,
    authKind: "guest",
  });
  return NextResponse.json({ token });
}
