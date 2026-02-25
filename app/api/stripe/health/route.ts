import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { logWithContext } from "@/app/api/_lib/errorHandler";
import { getSqlInstance } from "@/app/api/_lib/db/shared";
import { getIdempotencyService } from "@/app/api/_lib/services/idempotencyService";
import { getStripeInstance } from "@/app/api/_lib/services/stripeService";

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  services: {
    database: ServiceStatus;
    stripe: ServiceStatus;
    idempotency: ServiceStatus;
  };
  metrics?: HealthMetrics;
}

interface ServiceStatus {
  status: "up" | "down" | "degraded";
  message?: string;
  responseTime?: number;
}

interface HealthMetrics {
  webhookStats: {
    totalProcessed: number;
    currentlyProcessing: number;
    failedToday: number;
    avgRetryCount: number;
  };
  databaseConnections: number;
}

export async function GET() {
  const requestId = randomUUID();
  const startTime = Date.now();

  const healthStatus: HealthStatus = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    services: {
      database: { status: "up" },
      stripe: { status: "up" },
      idempotency: { status: "up" },
    },
  };

  try {
    // Check database connectivity
    const dbStart = Date.now();
    try {
      const sql = await getSqlInstance();
      await sql.query("SELECT 1 as health_check");
      healthStatus.services.database.responseTime = Date.now() - dbStart;
    } catch (error) {
      healthStatus.services.database = {
        status: "down",
        message: error instanceof Error ? error.message : "Database connection failed",
      };
      healthStatus.status = "unhealthy";
    }

    // Check Stripe connectivity
    const stripeStart = Date.now();
    try {
      const stripe = getStripeInstance();
      // Simple API call to test connectivity
      await stripe.products.list({ limit: 1 });
      healthStatus.services.stripe.responseTime = Date.now() - stripeStart;
    } catch (error) {
      healthStatus.services.stripe = {
        status: "down",
        message: error instanceof Error ? error.message : "Stripe API connection failed",
      };
      healthStatus.status = healthStatus.status === "unhealthy" ? "unhealthy" : "degraded";
    }

    // Check idempotency service
    const idempotencyStart = Date.now();
    try {
      const idempotencyService = getIdempotencyService();
      const stats = await idempotencyService.getProcessingStats();
      healthStatus.services.idempotency.responseTime = Date.now() - idempotencyStart;

      // Include metrics if available
      healthStatus.metrics = {
        webhookStats: {
          totalProcessed: stats.total_processed,
          currentlyProcessing: stats.currently_processing,
          failedToday: stats.failed_today,
          avgRetryCount: stats.avg_retry_count,
        },
        databaseConnections: 1, // Simplified - could be enhanced with actual connection count
      };
    } catch (error) {
      healthStatus.services.idempotency = {
        status: "down",
        message: error instanceof Error ? error.message : "Idempotency service failed",
      };
      healthStatus.status = healthStatus.status === "unhealthy" ? "unhealthy" : "degraded";
    }

    // Overall response time
    const totalResponseTime = Date.now() - startTime;

    logWithContext(
      "info",
      "health-check-completed",
      "Health check completed",
      {
        status: healthStatus.status,
        totalResponseTime,
        services: healthStatus.services,
      },
      requestId,
    );

    const statusCode = healthStatus.status === "healthy" ? 200 : healthStatus.status === "degraded" ? 200 : 503;

    return NextResponse.json(healthStatus, { status: statusCode });
  } catch (error) {
    healthStatus.status = "unhealthy";
    healthStatus.services.database = { status: "down", message: "Health check failed" };

    logWithContext(
      "error",
      "health-check-failed",
      "Health check failed completely",
      {
        error: error instanceof Error ? error.message : String(error),
      },
      requestId,
    );

    return NextResponse.json(healthStatus, { status: 503 });
  }
}
