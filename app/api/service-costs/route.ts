import { NextRequest, NextResponse } from "next/server";

/**
 * Service costs in credits
 * These values represent the cost in credits for various AI services
 */
const SERVICE_COSTS = {
  // Text generation (per 1K tokens)
  "text-generation-basic": 1,
  "text-generation-advanced": 2,
  
  // Image generation (per image)
  "image-generation-standard": 10,
  "image-generation-hd": 20,
  
  // OCR (per page)
  "ocr-basic": 2,
  "ocr-advanced": 5,
  
  // Default cost
  "default": 1,
};

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(SERVICE_COSTS);
  } catch (error) {
    console.error("Error fetching service costs:", error);
    return NextResponse.json(
      { error: "Failed to fetch service costs" },
      { status: 500 }
    );
  }
}







