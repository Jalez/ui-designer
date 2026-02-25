/**
 * Credit Service Configuration
 * Centralized configuration for all magic numbers and fallback values
 */

// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  PAYMENT_REQUIRED: 402,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
  TOO_MANY_REQUESTS: 429,
} as const;

// Default Credit Values
export const DEFAULT_CREDITS = {
  // Default estimated cost for services when no model info is available
  ESTIMATED_COST: 1,

  // Default fallback values for credit calculations
  FALLBACK_CREDITS: 0,

  // Default multiplier for max credits (2x monthly credits)
} as const;

// Rate Limiting Configuration
export const RATE_LIMITS = {
  // Daily request limit for unauthenticated users
  DAILY_LIMIT: 50,

  // Time window for rate limiting
  TIME_WINDOW: "1 d",
} as const;

// Token Estimation Constants
export const TOKEN_ESTIMATION = {
  // Characters per token for local models (roughly 1 token per 4 characters)
  CHARS_PER_TOKEN: 4,

  // Minimum tokens to consider for tracking
  MIN_TRACKING_TOKENS: 0,
} as const;

// File Processing Limits
export const FILE_LIMITS = {
  // Maximum number of images to process in a single request
  MAX_IMAGES_PER_REQUEST: 5,

  // File size calculation (bytes to MB)
  BYTES_PER_MB: 1024 * 1024,
} as const;

// AI Generation Configuration
export const AI_CONFIG = {
  // Default temperature for text generation
  DEFAULT_TEMPERATURE: 0.7,

  // Default number of images to generate
  DEFAULT_IMAGE_COUNT: 1,

  // Default image model
  DEFAULT_IMAGE_MODEL: "gpt-image-1",

  // Response length limits for different operations
  RESPONSE_LIMITS: {
    CONTINUE: 200,
    IMPROVE: 200,
    FIX: 200,
  },
} as const;

// Mock/Debug Configuration
export const MOCK_CONFIG = {
  // Default mock delay in milliseconds
  DEFAULT_DELAY: 2000,

  // Minimum delay for status updates
  MIN_STATUS_DELAY: 200,

  // Delay for processing simulation
  PROCESSING_DELAY: 100,

  // Partial image count for streaming
  PARTIAL_IMAGE_COUNT: 2,
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  AUTHENTICATION_REQUIRED: "Authentication required",
  INSUFFICIENT_CREDITS: "Insufficient credits",
  CREDIT_VALIDATION_FAILED: "Credit validation failed",
  COST_CALCULATION_FAILED: "Cost calculation failed",
  MODEL_NOT_FOUND: "Model not found",
  INVALID_MODEL: "Invalid model for this operation",
  NO_MODELS_AVAILABLE: "No models available",
  RATE_LIMIT_EXCEEDED: "Rate limit exceeded",
  API_QUOTA_EXCEEDED: "API quota exceeded",
  CONTENT_POLICY_VIOLATION: "Content policy violation",
  GENERATION_FAILED: "Generation failed",
  MOCK_GENERATION_FAILED: "Mock generation failed",
} as const;

// Service Names (to avoid magic strings)
export const SERVICE_NAMES = {
  TEXT_COMPLETION: "text_completion",
  IMAGE_GENERATION: "image_generation",
  VISION_OCR: "vision_ocr",
  DOC_AI_EXTRACT: "doc_ai_extract",
  VISION_PDF: "vision_pdf",
  PDF_GENERATION: "pdf_generation",
  IMAGE_PROCESSING: "image_processing",
} as const;

// Database Query Constants
export const DB_CONSTANTS = {
  // Default limit for database queries
  DEFAULT_QUERY_LIMIT: 50,

  // Default offset for pagination
  DEFAULT_OFFSET: 0,
} as const;

// Validation Constants
export const VALIDATION = {
  // Minimum string length for prompts
  MIN_PROMPT_LENGTH: 1,

  // Maximum prompt preview length for logging
  MAX_PROMPT_PREVIEW: 50,
} as const;
