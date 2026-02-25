import { useCreditsStore } from "../store/creditsStore";

/**
 * Service costs response from API
 */
export interface ServiceCostsResponse {
  serviceCosts: Record<string, number>;
  costBreakdown: Record<
    string,
    {
      cost: number;
      estimate: {
        promptTokens?: number;
        completionTokens?: number;
        imageCount?: number;
        model?: string;
        pricing?: Record<string, string>;
      };
    }
  >;
  lastUpdated: string;
  note: string;
}

/**
 * Result of checking credits for a service
 */
export interface CreditsCheckResult {
  hasEnough: boolean;
  requiredCredits: number;
  currentCredits: number;
}

/**
 * Fetch current service costs from the backend
 */
export async function fetchServiceCosts(): Promise<ServiceCostsResponse> {
  try {
    const response = await fetch("/api/service-costs");

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch service costs: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Failed to fetch service costs:", error);
    throw error;
  }
}

/**
 * Check if user has enough credits for a specific service
 * Uses cached credits from store and fetches service costs
 */
export async function checkCreditsForService(serviceName: string): Promise<CreditsCheckResult> {
  // Get current credits from store (cached)
  const { credits } = useCreditsStore.getState();
  const currentCredits = credits?.current || 0;

  // Fetch service costs from API
  const serviceCostsData = await fetchServiceCosts();
  const requiredCredits = serviceCostsData.serviceCosts[serviceName] || 1;

  return {
    hasEnough: currentCredits >= requiredCredits,
    requiredCredits,
    currentCredits,
  };
}

/**
 * Get the cost for a specific service
 */
export async function getServiceCost(serviceName: string): Promise<number> {
  const serviceCostsData = await fetchServiceCosts();
  return serviceCostsData.serviceCosts[serviceName] || 1;
}
