import { NextResponse } from "next/server";

function disabled() {
  return NextResponse.json(
    {
      error: "Billing and credits are currently disabled",
      billingEnabled: false,
    },
    { status: 410 },
  );
}

export async function GET() {
  return disabled();
}

export async function POST() {
  return disabled();
}

export async function PUT() {
  return disabled();
}

export async function PATCH() {
  return disabled();
}

export async function DELETE() {
  return disabled();
}
