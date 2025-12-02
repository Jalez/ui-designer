import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    timestamp: string;
    requestId: string;
  };
}

export class AppError extends Error {
  public code: string;
  public statusCode: number;
  public details?: Record<string, unknown>;

  constructor(message: string, code: string, statusCode: number = 500, details?: Record<string, unknown>) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

// Standardized error codes
export const ERROR_CODES = {
  PLAN_NOT_SET: "PLAN_NOT_SET",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  WEBHOOK_SIGNATURE_INVALID: "WEBHOOK_SIGNATURE_INVALID",
  WEBHOOK_PROCESSING_FAILED: "WEBHOOK_PROCESSING_FAILED",
  WEBHOOK_DUPLICATE: "WEBHOOK_DUPLICATE",
  DATABASE_ERROR: "DATABASE_ERROR",
  STRIPE_API_ERROR: "STRIPE_API_ERROR",
  AUTHENTICATION_ERROR: "AUTHENTICATION_ERROR",
  AUTHORIZATION_ERROR: "AUTHORIZATION_ERROR",
  NOT_FOUND: "NOT_FOUND",
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  CREDITS_NOT_SET: "CREDITS_NOT_SET",
  SUBSCRIPTION_NOT_SET: "SUBSCRIPTION_NOT_SET",
} as const;

export function createErrorResponse(error: AppError | Error, requestId?: string): ErrorResponse {
  const id = requestId || randomUUID();

  if (error instanceof AppError) {
    return {
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
        timestamp: new Date().toISOString(),
        requestId: id,
      },
    };
  }

  // Generic error handling
  return {
    error: {
      code: ERROR_CODES.INTERNAL_ERROR,
      message: "An unexpected error occurred",
      timestamp: new Date().toISOString(),
      requestId: id,
    },
  };
}

export function createNextResponse(error: AppError | Error, requestId?: string): NextResponse<ErrorResponse> {
  const errorResponse = createErrorResponse(error, requestId);

  let statusCode = 500;
  if (error instanceof AppError) {
    statusCode = error.statusCode;
  }

  return NextResponse.json(errorResponse, { status: statusCode });
}

// Retry utility with exponential backoff
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
  operationName: string = "operation",
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxRetries) {
        console.error(`SERVER: RETRY-FAILED: ${operationName} failed after ${maxRetries} attempts:`, error);
        throw lastError;
      }

      const delay = baseDelay * 2 ** (attempt - 1);
      console.warn(
        `SERVER: RETRY-ATTEMPT: ${operationName} failed on attempt ${attempt}/${maxRetries}, retrying in ${delay}ms:`,
        error,
      );
      await sleep(delay);
    }
  }

  // This should never happen due to the logic above, but TypeScript needs it
  if (lastError) {
    throw lastError;
  }
  throw new Error(`${operationName} failed after ${maxRetries} retries`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Idempotency key utilities
export function generateIdempotencyKey(eventId: string, eventType: string, created: number): string {
  return `webhook_${eventType}_${eventId}_${created}`;
}

// Structured logging utility
export function logWithContext(
  level: "info" | "warn" | "error",
  context: string,
  message: string,
  data?: Record<string, unknown>,
  requestId?: string,
): void {
  const timestamp = new Date().toISOString();
  const _logEntry = {
    timestamp,
    level,
    context,
    message,
    requestId,
    ...(data && { data }),
  };

  const logMessage = `SERVER: ${context.toUpperCase()}: ${message}`;

  switch (level) {
    case "info":
      console.log(logMessage, data ? JSON.stringify(data) : "");
      break;
    case "warn":
      console.warn(logMessage, data ? JSON.stringify(data) : "");
      break;
    case "error":
      console.error(logMessage, data ? JSON.stringify(data) : "");
      break;
  }
}
