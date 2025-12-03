// Level service types

export interface Level {
  identifier: string;
  name: string;
  json: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface CreateLevelOptions {
  name: string;
  json: Record<string, any>;
}

export interface UpdateLevelOptions {
  name?: string;
  json?: Record<string, any>;
}

