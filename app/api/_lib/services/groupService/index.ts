import { sql } from "@/app/api/_lib/db";
import { extractRows } from "../../db/shared";

export interface Group {
  id: string;
  name: string;
  ltiContextId?: string;
  ltiContextTitle?: string;
  resourceLinkId?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  role: "instructor" | "member";
  joinedAt: Date;
}

export interface GroupWithMembers extends Group {
  members: GroupMember[];
}

export interface CreateGroupOptions {
  name: string;
  ltiContextId?: string;
  ltiContextTitle?: string;
  resourceLinkId?: string;
  createdBy?: string;
}

export interface AddMemberOptions {
  groupId: string;
  userId: string;
  role?: "instructor" | "member";
}

export async function createGroup(options: CreateGroupOptions): Promise<Group> {
  const sqlInstance = await sql();
  const now = new Date();

  const result = await sqlInstance`
    INSERT INTO "Groups" (name, "ltiContextId", "ltiContextTitle", "resourceLinkId", "createdBy", "createdAt", "updatedAt")
    VALUES (${options.name}, ${options.ltiContextId || null}, ${options.ltiContextTitle || null}, ${options.resourceLinkId || null}, ${options.createdBy || null}, ${now}, ${now})
    RETURNING id, name, "ltiContextId", "ltiContextTitle", "resourceLinkId", "createdBy", "createdAt", "updatedAt"
  `;

  const rows = extractRows(result);
  if (rows.length === 0) {
    throw new Error("Failed to create group");
  }

  return {
    id: rows[0].id,
    name: rows[0].name,
    ltiContextId: rows[0].ltiContextId,
    ltiContextTitle: rows[0].ltiContextTitle,
    resourceLinkId: rows[0].resourceLinkId,
    createdBy: rows[0].createdBy,
    createdAt: rows[0].createdAt,
    updatedAt: rows[0].updatedAt,
  };
}

export async function getGroupById(groupId: string): Promise<Group | null> {
  const sqlInstance = await sql();

  const result = await sqlInstance`
    SELECT id, name, "ltiContextId", "ltiContextTitle", "resourceLinkId", "createdBy", "createdAt", "updatedAt"
    FROM "Groups"
    WHERE id = ${groupId}
    LIMIT 1
  `;

  const rows = extractRows(result);
  if (rows.length === 0) {
    return null;
  }

  return {
    id: rows[0].id,
    name: rows[0].name,
    ltiContextId: rows[0].ltiContextId,
    ltiContextTitle: rows[0].ltiContextTitle,
    resourceLinkId: rows[0].resourceLinkId,
    createdBy: rows[0].createdBy,
    createdAt: rows[0].createdAt,
    updatedAt: rows[0].updatedAt,
  };
}

export async function getGroupByLtiContextId(ltiContextId: string): Promise<Group | null> {
  const sqlInstance = await sql();

  const result = await sqlInstance`
    SELECT id, name, "ltiContextId", "ltiContextTitle", "resourceLinkId", "createdBy", "createdAt", "updatedAt"
    FROM "Groups"
    WHERE "ltiContextId" = ${ltiContextId}
    LIMIT 1
  `;

  const rows = extractRows(result);
  if (rows.length === 0) {
    return null;
  }

  return {
    id: rows[0].id,
    name: rows[0].name,
    ltiContextId: rows[0].ltiContextId,
    ltiContextTitle: rows[0].ltiContextTitle,
    resourceLinkId: rows[0].resourceLinkId,
    createdBy: rows[0].createdBy,
    createdAt: rows[0].createdAt,
    updatedAt: rows[0].updatedAt,
  };
}

export async function getOrCreateGroupByLtiContext(
  ltiContextId: string,
  name: string,
  resourceLinkId?: string
): Promise<Group> {
  const existing = await getGroupByLtiContextId(ltiContextId);
  if (existing) {
    return existing;
  }

  return createGroup({
    name,
    ltiContextId,
    ltiContextTitle: name,
    resourceLinkId,
  });
}

export async function addGroupMember(options: AddMemberOptions): Promise<GroupMember> {
  const sqlInstance = await sql();
  const now = new Date();
  const role = options.role || "member";

  const result = await sqlInstance`
    INSERT INTO "GroupMembers" ("groupId", "userId", role, "joinedAt", "createdAt", "updatedAt")
    VALUES (${options.groupId}, ${options.userId}, ${role}, ${now}, ${now}, ${now})
    ON CONFLICT ("groupId", "userId") DO UPDATE SET role = ${role}, "updatedAt" = ${now}
    RETURNING id, "groupId", "userId", role, "joinedAt"
  `;

  const rows = extractRows(result);
  if (rows.length === 0) {
    throw new Error("Failed to add group member");
  }

  return {
    id: rows[0].id,
    groupId: rows[0].groupId,
    userId: rows[0].userId,
    role: rows[0].role,
    joinedAt: rows[0].joinedAt,
  };
}

export async function getGroupMembers(groupId: string): Promise<GroupMember[]> {
  const sqlInstance = await sql();

  const result = await sqlInstance`
    SELECT id, "groupId", "userId", role, "joinedAt"
    FROM "GroupMembers"
    WHERE "groupId" = ${groupId}
    ORDER BY "joinedAt" ASC
  `;

  const rows = extractRows(result);
  return rows.map((row) => ({
    id: row.id,
    groupId: row.groupId,
    userId: row.userId,
    role: row.role,
    joinedAt: row.joinedAt,
  }));
}

export async function getUserGroups(userId: string): Promise<Group[]> {
  const sqlInstance = await sql();

  const result = await sqlInstance`
    SELECT g.id, g.name, g."ltiContextId", g."ltiContextTitle", g."resourceLinkId", g."createdBy", g."createdAt", g."updatedAt"
    FROM "Groups" g
    INNER JOIN "GroupMembers" gm ON g.id = gm."groupId"
    WHERE gm."userId" = ${userId}
    ORDER BY g."createdAt" DESC
  `;

  const rows = extractRows(result);
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    ltiContextId: row.ltiContextId,
    ltiContextTitle: row.ltiContextTitle,
    resourceLinkId: row.resourceLinkId,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

export async function isGroupMember(groupId: string, userId: string): Promise<boolean> {
  const sqlInstance = await sql();

  const result = await sqlInstance`
    SELECT id
    FROM "GroupMembers"
    WHERE "groupId" = ${groupId} AND "userId" = ${userId}
    LIMIT 1
  `;

  return extractRows(result).length > 0;
}

export async function removeGroupMember(groupId: string, userId: string): Promise<boolean> {
  const sqlInstance = await sql();

  await sqlInstance`
    DELETE FROM "GroupMembers"
    WHERE "groupId" = ${groupId} AND "userId" = ${userId}
  `;

  return true;
}

export async function deleteGroup(groupId: string): Promise<boolean> {
  const sqlInstance = await sql();

  await sqlInstance`
    DELETE FROM "GroupMembers"
    WHERE "groupId" = ${groupId}
  `;

  await sqlInstance`
    DELETE FROM "Groups"
    WHERE id = ${groupId}
  `;

  return true;
}
