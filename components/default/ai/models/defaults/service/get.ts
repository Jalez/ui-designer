/**
 * Fetch user default models from the API
 */
export async function getUserDefaults(userId: string): Promise<{
  textModel: string | null;
  imageModel: string | null;
  imageOCRModel: string | null;
  pdfOCRModel: string | null;
}> {
  const response = await fetch(`/api/user/settings/models/read`);

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Authentication required");
    }
    throw new Error(`Failed to fetch user defaults: ${response.statusText}`);
  }

  return await response.json();
}
