import type { Project } from "../../types";

export interface CreateProjectOptions {
  mapName: string;
  title?: string;
}

/**
 * Create a new project for a user
 */
export async function createProject(options: CreateProjectOptions): Promise<Project> {
  try {
    const { mapName, title = "New Project" } = options;

    const response = await fetch(`/api/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mapName, title }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Authentication required to create projects");
      }
      throw new Error(`Failed to create project: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Failed to create project:", error);
    throw error;
  }
}







