import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { createNextResponse, logWithContext } from "@/app/api/_lib/errorHandler";
import { getStripePlans } from "@/app/api/_lib/services/stripeService";
import { authOptions } from "@/lib/auth";


export async function GET() {
  const requestId = randomUUID();
  let session: any = null;

  try {
    session = await getServerSession(authOptions);


    // Use the plans service to get all plans
    const result = await getStripePlans();

    return NextResponse.json(result);
  } catch (error) {
    logWithContext("error", "plans-fetch-failed", "Failed to fetch plans from Stripe", { error }, requestId);
    return createNextResponse(error as Error, requestId);
  }
}
