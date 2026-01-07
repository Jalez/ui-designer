/**
 * Save user default models to the API
 */
export async function saveUserDefaults(userId: string, defaults: {
  textModel?: string | null;
  imageModel?: string | null;
  imageOCRModel?: string | null;
  pdfOCRModel?: string | null;
}): Promise<void> {
  const response = await fetch(`/api/settings/${userId}/models/update`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      textModel: defaults.textModel,
      imageModel: defaults.imageModel,
      imageOCRModel: defaults.imageOCRModel,
      pdfOCRModel: defaults.pdfOCRModel,
    }),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Authentication required");
    } else if (response.status === 400) {
      throw new Error("Invalid model values");
    }
    throw new Error(`Failed to save user defaults: ${response.statusText}`);
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error("Failed to save user defaults");
  }
}
