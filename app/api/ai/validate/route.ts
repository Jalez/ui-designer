import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { resolveAllowedAiEndpoint } from "@/lib/ai/allowedEndpoints";

type ValidateRequestBody = {
  apiEndpoint?: string;
  apiKey?: string;
};

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeModelsUrl(apiEndpoint: string): string {
  const trimmed = apiEndpoint.trim().replace(/\/+$/, "");
  return `${trimmed}/models`;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = (await request.json()) as ValidateRequestBody;
    const apiEndpoint = String(body.apiEndpoint || "").trim();
    const apiKey = String(body.apiKey || "").trim();

    if (!apiEndpoint) {
      return NextResponse.json(
        {
          endpointValid: false,
          keyValid: false,
          endpointMessage: "API endpoint is required.",
          keyMessage: "Enter an API endpoint before validating the API key.",
        },
        { status: 400 },
      );
    }

    if (!isValidHttpUrl(apiEndpoint)) {
      return NextResponse.json(
        {
          endpointValid: false,
          keyValid: false,
          endpointMessage: "API endpoint must be a valid http or https URL.",
          keyMessage: "Fix the API endpoint before validating the API key.",
        },
        { status: 200 },
      );
    }

    // Validating an endpoint means the server calls it, so it must be allowlisted too.
    const allowedEndpoint = resolveAllowedAiEndpoint(apiEndpoint);

    if (!allowedEndpoint) {
      return NextResponse.json(
        {
          endpointValid: false,
          keyValid: false,
          endpointMessage: "API endpoint is not on the allowed provider list.",
          keyMessage: "Choose an allowed API endpoint before validating the API key.",
        },
        { status: 200 },
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        {
          endpointValid: true,
          keyValid: false,
          endpointMessage: "API endpoint looks valid.",
          keyMessage: "API key is required.",
        },
        { status: 400 },
      );
    }

    const response = await fetch(normalizeModelsUrl(allowedEndpoint), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      cache: "no-store",
      redirect: "error",
    });

    if (!response.ok) {
      let details = `${response.status} ${response.statusText}`.trim();
      try {
        const errorData = await response.json();
        const message =
          typeof errorData?.error?.message === "string"
            ? errorData.error.message
            : typeof errorData?.message === "string"
              ? errorData.message
              : null;
        if (message) {
          details = message;
        }
      } catch {
        // Ignore JSON parsing errors and fall back to HTTP status text.
      }

      return NextResponse.json(
        {
          endpointValid: true,
          keyValid: false,
          endpointMessage: "API endpoint responded successfully.",
          keyMessage: `API key validation failed: ${details}`,
        },
        { status: 200 },
      );
    }

    let modelCount: number | null = null;
    try {
      const data = await response.json();
      modelCount = Array.isArray(data?.data) ? data.data.length : null;
    } catch {
      // Successful authentication is enough even if the body is not JSON.
    }

    return NextResponse.json({
      endpointValid: true,
      keyValid: true,
      endpointMessage: "API endpoint responded successfully.",
      keyMessage:
        modelCount !== null
          ? `API key is valid. ${modelCount} models available.`
          : "API key is valid.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        endpointValid: false,
        keyValid: false,
        endpointMessage: error instanceof Error ? `API endpoint check failed: ${error.message}` : "Failed to validate API endpoint.",
        keyMessage: "API key could not be validated because the endpoint check failed.",
      },
      { status: 500 },
    );
  }
}
