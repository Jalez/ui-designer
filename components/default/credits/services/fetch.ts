/**
 * Fetch user credits from the API
 */
export interface CreditsApiResponse {
  credits: number;
  totalEarned: number;
  totalUsed: number;
  lastResetDate?: string;
}

/**
 * Fetch credits from the API
 */
export async function fetchCredits(userId: string): Promise<CreditsApiResponse> {
  try {
    const response = await fetch(`/api/user/credits/read`);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch credits: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Failed to fetch credits:", error);
    throw error;
  }
}
