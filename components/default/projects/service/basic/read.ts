import type { Project } from "../../types";

/**
 * Load all projects for a user
 */
export async function loadProjects(userId: string): Promise<Project[]> {
  try {
    const response = await fetch(`/api/projects`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Authentication required to load projects");
      }
      throw new Error(`Failed to load projects: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Failed to load projects:", error);
    throw error;
  }
}

/**
 * Get a single project by ID
 */
export async function getProject(id: string): Promise<Project> {
  try {
    const response = await fetch(`/api/projects/${id}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("Project not found");
      }
      if (response.status === 401) {
        throw new Error("Authentication required");
      }
      throw new Error(`Failed to get project: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Failed to get project:", error);
    throw error;
  }
}



