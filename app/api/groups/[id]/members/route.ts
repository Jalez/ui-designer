import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getGroupById,
  getGroupMembers,
  addGroupMember,
  isGroupMember,
} from "@/app/api/_lib/services/groupService";
import { getOrCreateUserByEmail, getUserByEmail } from "@/app/api/_lib/services/userService";

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

    const isMember = await isGroupMember(groupId, user.id);
    if (!isMember) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const members = await getGroupMembers(groupId);

    return NextResponse.json({ members });
  } catch (error) {
    console.error("Error fetching members:", error);
    return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: groupId } = await params;

    const group = await getGroupById(groupId);
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const body = await request.json();
    const { email, role } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const newUser = await getUserByEmail(email);
    if (!newUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const memberRole = role === "instructor" ? "instructor" : "member";
    const membership = await addGroupMember({
      groupId,
      userId: newUser.id,
      role: memberRole,
    });

    return NextResponse.json({ member: membership }, { status: 201 });
  } catch (error) {
    console.error("Error adding member:", error);
    return NextResponse.json({ error: "Failed to add member" }, { status: 500 });
  }
}
