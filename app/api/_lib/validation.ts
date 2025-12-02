import type { NextRequest } from "next/server";
import { AppError, ERROR_CODES } from "./errorHandler";

export interface ValidationRule {
  field: string;
  type: "string" | "number" | "boolean" | "email" | "price_id" | "uuid";
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: any) => boolean | string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  data: Record<string, any>;
}

/**
 * Validate request data against a set of rules
 */
export function validateRequestData(data: any, rules: ValidationRule[]): ValidationResult {
  const errors: string[] = [];
  const validatedData: Record<string, any> = {};

  for (const rule of rules) {
    const value = data[rule.field];

    // Check required fields
    if (rule.required && (value === undefined || value === null || value === "")) {
      errors.push(`${rule.field} is required`);
      continue;
    }

    // Skip validation for optional fields that are empty
    if (!rule.required && (value === undefined || value === null || value === "")) {
      continue;
    }

    // Type validation
    let isValidType = true;
    let validatedValue = value;

    switch (rule.type) {
      case "string":
        if (typeof value !== "string") {
          isValidType = false;
        } else {
          validatedValue = value.trim();

          // Length validation
          if (rule.minLength && validatedValue.length < rule.minLength) {
            errors.push(`${rule.field} must be at least ${rule.minLength} characters`);
            continue;
          }
          if (rule.maxLength && validatedValue.length > rule.maxLength) {
            errors.push(`${rule.field} must be at most ${rule.maxLength} characters`);
            continue;
          }

          // Pattern validation
          if (rule.pattern && !rule.pattern.test(validatedValue)) {
            errors.push(`${rule.field} format is invalid`);
            continue;
          }
        }
        break;

      case "number": {
        const numValue = typeof value === "string" ? parseFloat(value) : value;
        if (isNaN(numValue) || typeof numValue !== "number") {
          isValidType = false;
        } else {
          validatedValue = numValue;
        }
        break;
      }

      case "boolean":
        if (typeof value !== "boolean") {
          isValidType = false;
        }
        break;

      case "email":
        if (typeof value !== "string" || !isValidEmail(value)) {
          isValidType = false;
        }
        break;

      case "price_id":
        if (typeof value !== "string" || !value.startsWith("price_")) {
          errors.push(`${rule.field} must be a valid Stripe price ID (starting with 'price_')`);
          continue;
        }
        break;

      case "uuid":
        if (typeof value !== "string" || !isValidUUID(value)) {
          isValidType = false;
        }
        break;
    }

    if (!isValidType) {
      errors.push(`${rule.field} must be of type ${rule.type}`);
      continue;
    }

    // Custom validation
    if (rule.custom) {
      const customResult = rule.custom(validatedValue);
      if (customResult !== true) {
        const errorMsg = typeof customResult === "string" ? customResult : `${rule.field} failed custom validation`;
        errors.push(errorMsg);
        continue;
      }
    }

    validatedData[rule.field] = validatedValue;
  }

  return {
    isValid: errors.length === 0,
    errors,
    data: validatedData,
  };
}

/**
 * Validate JSON request body
 */
export async function validateJsonRequest(request: NextRequest, rules: ValidationRule[]): Promise<ValidationResult> {
  try {
    const body = await request.json();
    return validateRequestData(body, rules);
  } catch (error) {
    return {
      isValid: false,
      errors: ["Invalid JSON in request body"],
      data: {},
    };
  }
}

/**
 * Create validation error
 */
export function createValidationError(errors: string[], details?: Record<string, any>): AppError {
  return new AppError("Validation failed", ERROR_CODES.VALIDATION_ERROR, 400, {
    validationErrors: errors,
    ...details,
  });
}

/**
 * Helper functions
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Common validation rules
 */
export const commonValidationRules = {
  email: (required = true): ValidationRule => ({
    field: "email",
    type: "email",
    required,
  }),

  priceId: (required = true): ValidationRule => ({
    field: "priceId",
    type: "price_id",
    required,
  }),

  planId: (required = true): ValidationRule => ({
    field: "plan",
    type: "string",
    required,
    minLength: 1,
    maxLength: 100,
  }),

  userId: (required = true): ValidationRule => ({
    field: "userId",
    type: "uuid",
    required,
  }),

  credits: (required = true): ValidationRule => ({
    field: "credits",
    type: "number",
    required,
    custom: (value: number) => value > 0 || "Credits must be greater than 0",
  }),

  planName: (required = true): ValidationRule => ({
    field: "planName",
    type: "string",
    required,
    minLength: 1,
    maxLength: 100,
  }),
} as const;
