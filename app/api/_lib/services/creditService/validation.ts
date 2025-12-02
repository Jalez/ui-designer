import type { Session } from "next-auth";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { ensureUserInitialized, ensureUserInitializedByEmail } from "../userService";
import { DEFAULT_CREDITS, ERROR_MESSAGES, FILE_LIMITS, HTTP_STATUS } from "./config";
import { getCreditService } from "./index";
import type { ServiceUsageParams } from "./types";

export class CreditValidationError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public creditsRequired?: number,
    public creditsAvailable?: number,
  ) {
    super(message);
    this.name = "CreditValidationError";
  }
}

export interface CreditValidationResult {
  success: boolean;
  error?: {
    status: number;
    body: {
      error: string;
      message: string;
      creditsRequired?: number;
      creditsAvailable?: number;
    };
  };
  userId?: string;
  creditService?: ReturnType<typeof getCreditService>;
  actualCost?: number;
}

/**
 * Shared credit validation function for API routes
 * This ensures consistent credit checking across all endpoints
 */
export async function validateCredits(
  serviceName: string,
  estimatedCost: number = DEFAULT_CREDITS.ESTIMATED_COST,
  usageParams?: Partial<ServiceUsageParams>,
): Promise<CreditValidationResult> {
  try {
    // Get user session
    const session = (await getServerSession(authOptions)) as Session;

    if (!session?.user?.email) {
      return {
        success: false,
        error: {
          status: HTTP_STATUS.UNAUTHORIZED,
          body: {
            error: ERROR_MESSAGES.AUTHENTICATION_REQUIRED,
            message: "You must be logged in to use this service.",
          },
        },
      };
    }

    const userId = session.userId;
    const creditService = getCreditService();

    // Initialize user if not exists
    await ensureUserInitialized(userId);

    // Calculate actual cost if usage params are provided and all required parameters are available
    let actualCost = estimatedCost;
    if (usageParams?.modelInfo) {
      // Check if we have all required parameters for the service type
      const hasRequiredParams = (() => {
        switch (serviceName) {
          case "text_completion":
          case "AI Text Completion":
            return usageParams.promptTokens !== undefined && usageParams.completionTokens !== undefined;
          case "image_generation":
          case "AI Image Generation":
            return usageParams.imageCount !== undefined;
          case "vision_ocr":
          case "Vision OCR":
            return usageParams.imageCount !== undefined || usageParams.requestCount !== undefined;
          case "reasoning":
          case "Reasoning":
            return usageParams.promptTokens !== undefined && usageParams.completionTokens !== undefined;
          default:
            // For unknown services, assume we don't have required params
            return false;
        }
      })();

      if (hasRequiredParams) {
        try {
          console.log("🔍 COST_CALC: Calculating model-based cost", {
            userId,
            serviceName,
            usageParams,
          });

          actualCost = creditService.calculateServiceCost({
            userId,
            serviceName,
            ...usageParams,
          });

          console.log("🔍 COST_CALC: Model-based cost calculated", {
            actualCost,
            estimatedCost,
          });
        } catch (costError) {
          console.error("SERVER: COST-CALC-ERROR: Failed to calculate model-based cost:", costError);
          return {
            success: false,
            error: {
              status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
              body: {
                error: ERROR_MESSAGES.COST_CALCULATION_FAILED,
                message: "Unable to calculate service cost. Please try again or contact support.",
              },
            },
          };
        }
      } else {
        console.log("🔍 COST_CALC: Using estimated cost (required parameters not available)", {
          serviceName,
          hasPromptTokens: usageParams.promptTokens !== undefined,
          hasCompletionTokens: usageParams.completionTokens !== undefined,
          hasImageCount: usageParams.imageCount !== undefined,
          hasRequestCount: usageParams.requestCount !== undefined,
        });
      }
    } else {
      console.log("🔍 COST_CALC: Using estimated cost (no model info)", {
        actualCost,
        estimatedCost,
      });
    }

    // Check if user has enough credits
    console.log("🔍 CREDIT_CHECK: Checking if user has enough credits", {
      userId,
      actualCost,
      serviceName,
    });

    const hasEnoughCredits = await creditService.hasEnoughCredits({
      userId: userId,
      requiredCredits: actualCost,
    });
    console.log("🔍 CREDIT_CHECK: Credit check result", {
      hasEnoughCredits,
      actualCost,
    });

    if (!hasEnoughCredits) {
      const userCredits = await creditService.getUserCredits({ userId });
      console.log("❌ CREDIT_CHECK: Insufficient credits", {
        userId,
        actualCost,
        currentCredits: userCredits?.currentCredits,
      });

      return {
        success: false,
        error: {
          status: HTTP_STATUS.PAYMENT_REQUIRED,
          body: {
            error: ERROR_MESSAGES.INSUFFICIENT_CREDITS,
            message: "You need credits to use this service. Please upgrade your plan or subscription more credits.",
            creditsRequired: actualCost,
            creditsAvailable: userCredits?.currentCredits || DEFAULT_CREDITS.FALLBACK_CREDITS,
          },
        },
      };
    }

    console.log("✅ CREDIT_CHECK: User has sufficient credits", {
      userId,
      actualCost,
    });

    return {
      success: true,
      userId,
      creditService,
      actualCost,
    };
  } catch (creditError) {
    console.error("SERVER: CREDIT-ERROR: Credit validation failed:", creditError);
    return {
      success: false,
      error: {
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        body: {
          error: ERROR_MESSAGES.CREDIT_VALIDATION_FAILED,
          message: "Unable to validate your credit balance. Please try again or contact support.",
        },
      },
    };
  }
}

/**
 * Helper function to create error responses for different frameworks
 */
export function createErrorResponse(error: CreditValidationResult["error"]) {
  if (!error) return null;

  return {
    status: error.status,
    body: error.body,
  };
}

/**
 * Cost calculation utilities for common scenarios
 */
export const costCalculators = {
  /**
   * Simple fixed cost calculator
   */
  fixed: (cost: number) => async () => ({ metadata: { fixedCost: cost } }),

  /**
   * File size based calculator (per MB)
   */
  fileSize: async (request: Request) => {
    const contentLength = request.headers.get("content-length");
    if (contentLength) {
      const fileSizeMb = parseInt(contentLength, 10) / FILE_LIMITS.BYTES_PER_MB;
      return { fileSizeMb };
    }
    return {};
  },

  /**
   * PDF page count calculator (from form data)
   */
  pdfPages: async (request: Request) => {
    try {
      const formData = await request.formData();
      const pageCount = formData.get("pageCount");
      if (pageCount && typeof pageCount === "string") {
        return { pageCount: parseInt(pageCount, 10) };
      }
    } catch (_error) {
      // Ignore errors in cost calculation
    }
    return {};
  },

  /**
   * Combined file size and page count calculator
   */
  fileAndPages: async (request: Request) => {
    const fileSizeResult = await costCalculators.fileSize(request);
    const pageResult = await costCalculators.pdfPages(request);

    return {
      ...fileSizeResult,
      ...pageResult,
    };
  },
};

/**
 * Helper function to check credits without deducting them
 * Useful for UI components that need to show credit requirements
 */
export async function checkCredits(
  userEmail: string,
  serviceName: string,
  params?: Partial<ServiceUsageParams>,
): Promise<{
  hasEnough: boolean;
  required: number;
  available: number;
  userCredits: unknown;
}> {
  const creditService = getCreditService();

  const usageParams: ServiceUsageParams = {
    userId: userEmail,
    serviceName,
    ...params,
  };

  const required = await creditService.calculateServiceCost(usageParams);
  const hasEnough = await creditService.hasEnoughCredits({
    userId: userEmail,
    requiredCredits: required,
  });
  const userCredits = await creditService.getUserCredits({ userId: userEmail });

  return {
    hasEnough,
    required,
    available: userCredits?.currentCredits || DEFAULT_CREDITS.FALLBACK_CREDITS,
    userCredits,
  };
}

/**
 * Enhanced validation function that can calculate costs from request data
 */
export async function validateCreditsWithRequest(
  request: Request,
  serviceName: string,
  costCalculator?: (request: Request) => Promise<Partial<ServiceUsageParams>>,
  estimatedCost: number = DEFAULT_CREDITS.ESTIMATED_COST,
): Promise<CreditValidationResult> {
  let usageParams: Partial<ServiceUsageParams> = {};

  // Calculate usage parameters from request if calculator provided
  if (costCalculator) {
    try {
      usageParams = await costCalculator(request);
    } catch (error) {
      console.error("SERVER: COST-CALC-ERROR: Failed to calculate usage params:", error);
      return {
        success: false,
        error: {
          status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
          body: {
            error: ERROR_MESSAGES.COST_CALCULATION_FAILED,
            message: "Unable to calculate service cost from request data. Please try again or contact support.",
          },
        },
      };
    }
  }

  return validateCredits(serviceName, estimatedCost, usageParams);
}
