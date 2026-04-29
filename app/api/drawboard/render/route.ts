import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Server-side drawboard rendering is not available in browser capture mode" },
    { status: 501 },
  );
}
