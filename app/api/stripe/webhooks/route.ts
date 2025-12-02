import { randomUUID } from "crypto";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import {
  AppError,
  createNextResponse,
  ERROR_CODES,
  generateIdempotencyKey,
  logWithContext,
  retryWithBackoff,
} from "@/app/api/_lib/errorHandler";
import { getIdempotencyService } from "@/app/api/_lib/services/idempotencyService";
import { getStripeInstance, handleWebhookEvent } from "@/app/api/_lib/services/stripeService";

const stripe = getStripeInstance();
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!webhookSecret) {
  throw new Error("STRIPE_WEBHOOK_SECRET is not set");
}

export async function POST(request: NextRequest) {
  console.log("SERVER: WEBHOOK-RECEIVED: Processing webhook incoming");
  const requestId = randomUUID();
  const idempotencyService = getIdempotencyService();

  let event: Stripe.Event;

  try {
    // Parse and validate the webhook
    const body = await request.text();
    const headersList = await headers();
    const signature = headersList.get("stripe-signature");

    if (!signature) {
      logWithContext("error", "webhook-signature-missing", "Missing Stripe signature header", undefined, requestId);
      const error = new AppError("Missing Stripe signature", ERROR_CODES.WEBHOOK_SIGNATURE_INVALID, 400);
      return createNextResponse(error, requestId);
    }

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      logWithContext("error", "webhook-signature-invalid", "Invalid Stripe signature", { error: err }, requestId);
      const error = new AppError("Invalid Stripe signature", ERROR_CODES.WEBHOOK_SIGNATURE_INVALID, 400);
      return createNextResponse(error, requestId);
    }

    // Generate idempotency key and check for duplicate processing
    const idempotencyKey = generateIdempotencyKey(event.id, event.type, event.created);

    const alreadyProcessed = await idempotencyService.isEventProcessed(idempotencyKey);
    if (alreadyProcessed) {
      logWithContext(
        "info",
        "webhook-duplicate",
        "Webhook event already processed",
        {
          eventId: event.id,
          eventType: event.type,
          idempotencyKey,
        },
        requestId,
      );
      return NextResponse.json({ received: true, status: "already_processed" });
    }

    // Mark event as processing
    await idempotencyService.markEventProcessing(idempotencyKey, event.id, event.type);

    logWithContext(
      "info",
      "webhook-received",
      "Processing webhook event",
      {
        eventId: event.id,
        eventType: event.type,
        idempotencyKey,
      },
      requestId,
    );

    // Process webhook with retry logic
    await retryWithBackoff(
      async () => {
        try {
          await handleWebhookEvent(event);
          return true;
        } catch (processingError) {
          logWithContext(
            "warn",
            "webhook-processing-failed",
            "Webhook processing failed, will retry",
            {
              eventId: event.id,
              eventType: event.type,
              error: processingError,
            },
            requestId,
          );
          throw processingError;
        }
      },
      3, // max retries
      1000, // base delay (1 second)
      `webhook-${event.type}`,
    );

    // Mark as completed
    await idempotencyService.markEventCompleted(idempotencyKey);

    logWithContext(
      "info",
      "webhook-success",
      "Webhook processed successfully",
      {
        eventId: event.id,
        eventType: event.type,
      },
      requestId,
    );

    return NextResponse.json({ received: true, status: "processed" });
  } catch (error) {
    // Handle final failure after all retries
    const appError =
      error instanceof AppError
        ? error
        : new AppError("Webhook processing failed after retries", ERROR_CODES.WEBHOOK_PROCESSING_FAILED, 500, {
            originalError: error instanceof Error ? error.message : String(error),
          });

    logWithContext(
      "error",
      "webhook-final-failure",
      "Webhook processing failed permanently",
      {
        eventId: event?.id,
        eventType: event?.type,
        error: appError.message,
        details: appError.details,
      },
      requestId,
    );

    // Mark event as failed if we have an event
    if (event) {
      const idempotencyKey = generateIdempotencyKey(event.id, event.type, event.created);
      await idempotencyService.markEventFailed(idempotencyKey, appError.message, 3);
    }

    return createNextResponse(appError, requestId);
  }
}
