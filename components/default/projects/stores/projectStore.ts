import { create } from "zustand";
import { createProject, deleteProject, getProject, loadProjects, updateProject } from "../service";
import type { Project, ProjectState } from "../types";

export const useProjectStore = create<ProjectState>()((set, get) => ({
  // Initial state
  projects: [],
  currentProjectId: null,
  isLoading: false,
  isInitialized: false,
  loadingProjectId: null,

  // Create project
  createProject: async (userId: string, mapName: string, title?: string) => {
    const project = await createProject({ mapName, title });
    set((state) => ({
      projects: [project, ...state.projects],
    }));
    return project;
  },

  // Update project
  updateProject: async (id: string, updates: Partial<Project>) => {
    const updatedProject = await updateProject(id, updates);
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, ...updatedProject } : p
      ),
    }));
  },

  // Remove project
  removeProject: async (id: string) => {
    await deleteProject(id);
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      currentProjectId: state.currentProjectId === id ? null : state.currentProjectId,
    }));
  },

  // Clear projects
  clearProjects: () => {
    set({
      projects: [],
      currentProjectId: null,
      isInitialized: false,
    });
  },

  // Set current project ID
  setCurrentProjectId: (id: string) => {
    set({ currentProjectId: id });
  },

  // Update project progress
  updateProjectProgress: async (id: string, progressData: Record<string, any>) => {
    await get().updateProject(id, { progressData });
  },

  // Load projects from API
  loadProjects: async (userId: string) => {
    set({ isLoading: true });
    try {
      const projects = await loadProjects(userId);
      set({
        projects,
        isLoading: false,
        isInitialized: true,
      });
    } catch (error) {
      console.error("Failed to load projects:", error);
      set({ isLoading: false });
      throw error;
    }
  },

  // Load single project by ID
  loadProjectById: async (id: string) => {
    set({ loadingProjectId: id });
    try {
      const project = await getProject(id);
      set((state) => {
        const exists = state.projects.some((p) => p.id === id);
        return {
          projects: exists
            ? state.projects.map((p) => (p.id === id ? project : p))
            : [...state.projects, project],
          loadingProjectId: null,
        };
      });
      return project;
    } catch (error) {
      console.error("Failed to load project:", error);
      set({ loadingProjectId: null });
      return null;
    }
  },

  // Save project (update)
  saveProject: async (project: Project) => {
    await get().updateProject(project.id, project);
  },

  // Add project to store (optimistic update)
  addProjectToStore: (project: Project) => {
    set((state) => ({
      projects: [project, ...state.projects],
    }));
  },

  // Get project by ID
  getProjectById: (id: string) => {
    return get().projects.find((p) => p.id === id);
  },

  // Get current project
  getCurrentProject: () => {
    const { currentProjectId, projects } = get();
    if (!currentProjectId) return null;
    return projects.find((p) => p.id === currentProjectId) || null;
  },

  // Get all projects
  getProjects: () => {
    return get().projects;
  },
}));

