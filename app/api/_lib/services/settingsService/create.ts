import { getSqlInstance } from "../../db/shared";
import type { CreateUserDefaultsOptions } from "./types";

type CreateUserDefaultsParams = {
  userId: string;
  options: CreateUserDefaultsOptions;
};

/**
 * Create user default models
 */
export async function createUserDefaults({ userId, options }: CreateUserDefaultsParams): Promise<void> {
  const sqlInstance = await getSqlInstance();
  const now = new Date();

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
      ${options.text_model || null},
      ${options.image_model || null},
      ${options.image_ocr_model || null},
      ${options.pdf_ocr_model || null},
      ${now},
      ${now}
    )
  `;
}
