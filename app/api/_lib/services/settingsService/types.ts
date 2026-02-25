/**
 * Defaults Service Types
 *
 * Types for user default model preferences
 */

export interface UserDefaultModels {
  user_id: string;
  text_model: string | null;
  image_model: string | null;
  image_ocr_model: string | null;
  pdf_ocr_model: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface DatabaseUserDefaultModels {
  user_id: string;
  text_model: string | null;
  image_model: string | null;
  image_ocr_model: string | null;
  pdf_ocr_model: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserDefaultsOptions {
  text_model?: string | null;
  image_model?: string | null;
  image_ocr_model?: string | null;
  pdf_ocr_model?: string | null;
}

export interface UpdateUserDefaultsOptions extends CreateUserDefaultsOptions {
  // Same as CreateUserDefaultsOptions for updates
}
