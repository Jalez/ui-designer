import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { resolveSessionAdmin } from "@/app/api/_lib/services/adminService/read";
import { canActorEditMaps } from "@/app/api/_lib/services/gameService";
import { getMapNamesForLevel } from "@/app/api/_lib/services/mapService";

/**
 * Guards for map and level content, which has no owner column of its own:
 * ownership is derived from the games (projects) built on the map.
 *
 * Each guard returns the response to send back when access is denied, or null
 * when the caller may proceed. Guards run before existence checks so a denied
 * caller cannot tell an existing map/level from a missing one.
 */

// Level identifiers are UUIDs; anything else can never match a stored level.
const LEVEL_IDENTIFIER_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const unauthenticated = () => NextResponse.json({ error: "Authentication required" }, { status: 401 });

const forbidden = () => NextResponse.json({ error: "No edit access for this content" }, { status: 403 });

/**
 * Identifiers a game row may be matched against, mirroring app/api/games/[id].
 */
function getActorIdentifiers(session: Session): string[] {
  return [session.userId, session.user?.email].filter(Boolean) as string[];
}

/**
 * Require any authenticated caller. Used where the resource has no owner yet.
 */
export async function requireAuthenticated(): Promise<NextResponse | null> {
  const session = await getServerSession(authOptions);

  return session?.user?.email ? null : unauthenticated();
}

/**
 * Require edit access to a map: owner or collaborator of a game using it, or an admin.
 */
export async function requireMapEditAccess(mapName: string): Promise<NextResponse | null> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return unauthenticated();
  }

  if (await canActorEditMaps([mapName], getActorIdentifiers(session))) {
    return null;
  }

  return (await resolveSessionAdmin(session)) ? null : forbidden();
}

/**
 * Require edit access to a level through any map it is attached to, or admin.
 */
export async function requireLevelEditAccess(levelIdentifier: string): Promise<NextResponse | null> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return unauthenticated();
  }

  if (LEVEL_IDENTIFIER_REGEX.test(levelIdentifier)) {
    const mapNames = await getMapNamesForLevel(levelIdentifier);

    if (await canActorEditMaps(mapNames, getActorIdentifiers(session))) {
      return null;
    }
  }

  return (await resolveSessionAdmin(session)) ? null : forbidden();
}
