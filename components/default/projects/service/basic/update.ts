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
      throw new Error(`Failed to update project: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Failed to update project:", error);
    throw error;
  }
}

