import type { Project } from "../../types";

/**
 * Update a project
 */
export async function updateProject(
  id: string,
  updates: Partial<Pick<Project, "title" | "progressData">>
): Promise<Project> {
  try {
    const response = await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("Project not found");
      }
      if (response.status === 401) {
        throw new Error("Authentication required");
      }
      
      // Try to get error message from response
      const errorText = await response.text();
      let errorMessage = `Failed to update project: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorJson.error || errorMessage;
      } catch {
        if (errorText) {
          errorMessage += `: ${errorText}`;
        }
      }
      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error) {
    console.error("Failed to update project:", error);
    throw error;
  }
}



