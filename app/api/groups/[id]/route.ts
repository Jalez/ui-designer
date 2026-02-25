import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getGroupById,
  getGroupMembers,
  deleteGroup,
  isGroupMember,
} from "@/app/api/_lib/services/groupService";
import { getOrCreateUserByEmail } from "@/app/api/_lib/services/userService";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: groupId } = await params;
    const user = await getOrCreateUserByEmail(session.user.email);

    const group = await getGroupById(groupId);
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const isMember = await isGroupMember(groupId, user.id);
    if (!isMember) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const members = await getGroupMembers(groupId);

    return NextResponse.json({ group, members });
  } catch (error) {
    console.error("Error fetching group:", error);
    return NextResponse.json({ error: "Failed to fetch group" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: groupId } = await params;
    const user = await getOrCreateUserByEmail(session.user.email);

    const group = await getGroupById(groupId);
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    if (group.createdBy !== user.id) {
      return NextResponse.json({ error: "Only group creator can delete" }, { status: 403 });
    }

    await deleteGroup(groupId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting group:", error);
    return NextResponse.json({ error: "Failed to delete group" }, { status: 500 });
  }
}
