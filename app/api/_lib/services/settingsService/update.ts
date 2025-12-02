import { getSqlInstance } from "../../db/shared";
import type { UpdateUserDefaultsOptions } from "./types";

type UpdateUserDefaultsParams = {
  userId: string;
  updates: UpdateUserDefaultsOptions;
};

/**
 * Update user default models (UPSERT pattern)
 */
export async function updateUserDefaults({ userId, updates }: UpdateUserDefaultsParams): Promise<void> {
  const sqlInstance = await getSqlInstance();
  const now = new Date();

  // Use UPSERT to insert if not exists, update if exists
  await sqlInstance`
    INSERT INTO user_default_models (
      user_id,
      text_model,
      image_model,
      image_ocr_model,
      pdf_ocr_model,
      created_at,
      updated_at
    ) VALUES (
      ${userId},
      ${updates.text_model || null},
      ${updates.image_model || null},
      ${updates.image_ocr_model || null},
      ${updates.pdf_ocr_model || null},
      ${now},
      ${now}
    )
    ON CONFLICT (user_id)
    DO UPDATE SET
      text_model = COALESCE(EXCLUDED.text_model, user_default_models.text_model),
      image_model = COALESCE(EXCLUDED.image_model, user_default_models.image_model),
      image_ocr_model = COALESCE(EXCLUDED.image_ocr_model, user_default_models.image_ocr_model),
      pdf_ocr_model = COALESCE(EXCLUDED.pdf_ocr_model, user_default_models.pdf_ocr_model),
      updated_at = EXCLUDED.updated_at
  `;
}
