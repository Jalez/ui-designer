/**
 * Delete a project
 */
export async function deleteProject(id: string): Promise<void> {
  try {
    const response = await fetch(`/api/projects/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("Project not found");
      }
      if (response.status === 401) {
        throw new Error("Authentication required");
      }
      throw new Error(`Failed to delete project: ${response.status}`);
    }
  } catch (error) {
    console.error("Failed to delete project:", error);
    throw error;
  }
}

