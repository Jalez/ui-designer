import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { renderDrawboardScreenshot } from "@/app/api/_lib/services/drawboardRenderService";

export const runtime = "nodejs";

const MAX_CAPTURE_DIMENSION = 2000;

const renderSchema = z.object({
  css: z.string().default(""),
  snapshotHtml: z.string().min(1),
  width: z.number().int().min(1).max(MAX_CAPTURE_DIMENSION),
  height: z.number().int().min(1).max(MAX_CAPTURE_DIMENSION),
  scenarioId: z.string().min(1),
  urlName: z.enum(["drawingUrl", "solutionUrl"]),
  includeDataUrl: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json();
    const payload = renderSchema.parse(rawBody);
    const result = await renderDrawboardScreenshot(payload);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Invalid drawboard render request",
          details: error.flatten(),
        },
        { status: 400 },
      );
    }

    console.error("Drawboard render failed", error);
    return NextResponse.json(
      { error: "Failed to render drawboard screenshot" },
      { status: 500 },
    );
  }
}
