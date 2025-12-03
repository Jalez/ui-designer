// Project service types

export interface Project {
  id: string;
  user_id: string;
  map_name: string;
  title: string;
  progress_data: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface CreateProjectOptions {
  userId: string;
  mapName: string;
  title: string;
  progressData?: Record<string, any>;
}

export interface UpdateProjectOptions {
  title?: string;
  progressData?: Record<string, any>;
}

