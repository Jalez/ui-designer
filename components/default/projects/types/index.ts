export interface Project {
  id: string;
  userId: string;
  mapName: string;
  title: string;
  progressData: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectState {
  // State
  projects: Project[];
  currentProjectId: string | null;
  isLoading: boolean;
  isInitialized: boolean;
  loadingProjectId: string | null;

  // Actions
  createProject: (userId: string, mapName: string, title?: string) => Promise<Project>;
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
  removeProject: (id: string) => Promise<void>;
  clearProjects: () => void;

  setCurrentProjectId: (id: string) => void;

  // Content operations
  updateProjectProgress: (id: string, progressData: Record<string, any>) => Promise<void>;

  // Database operations
  loadProjects: (userId: string) => Promise<void>;
  loadProjectById: (id: string) => Promise<Project | null>;
  saveProject: (project: Project) => Promise<void>;
  addProjectToStore: (project: Project) => void;

  // Utilities
  getProjectById: (id: string) => Project | undefined;
  getCurrentProject: () => Project | null;
  getProjects: () => Project[];
}







