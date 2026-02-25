import { type NextRequest, NextResponse } from "next/server";
import { withAdminOrUserAuth } from "@/app/api/_lib/middleware/admin";
import { DefaultsService } from "@/app/api/_lib/services/settingsService";

export const GET = withAdminOrUserAuth(async (request: NextRequest, context) => {
  try {
    const userEmail = context.params.userEmail;
    const userDefaults = await DefaultsService.getUserDefaults(userEmail);

    if (!userDefaults) {
      // Return empty defaults if user has no saved preferences
      return NextResponse.json({
        textModel: null,
        imageModel: null,
        imageOCRModel: null,
        pdfOCRModel: null,
      });
    }

    return NextResponse.json({
      textModel: userDefaults.text_model,
      imageModel: userDefaults.image_model,
      imageOCRModel: userDefaults.image_ocr_model,
      pdfOCRModel: userDefaults.pdf_ocr_model,
    });
  } catch (error) {
    console.error("Error fetching user model settings:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
