export interface Game {
  id: string;
  user_id: string;
  map_name: string;
  title: string;
  progress_data: Record<string, unknown>;
  is_public: boolean;
  share_token: string | null;
  thumbnail_url: string | null;
  hide_sidebar: boolean;
  access_window_enabled: boolean;
  access_starts_at: Date | null;
  access_ends_at: Date | null;
  access_key_required: boolean;
  access_key: string | null;
  collaboration_mode: "individual" | "group";
  is_owner?: boolean;
  is_collaborator?: boolean;
  can_edit?: boolean;
  can_manage_collaborators?: boolean;
  can_remove_collaborators?: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateGameOptions {
  userId: string;
  mapName: string;
  title: string;
  progressData?: Record<string, unknown>;
}

export interface UpdateGameOptions {
  title?: string;
  progressData?: Record<string, unknown>;
  isPublic?: boolean;
  shareToken?: string | null;
  thumbnailUrl?: string | null;
  hideSidebar?: boolean;
  accessWindowEnabled?: boolean;
  accessStartsAt?: Date | null;
  accessEndsAt?: Date | null;
  accessKeyRequired?: boolean;
  accessKey?: string | null;
  collaborationMode?: "individual" | "group";
}

export interface GameCollaborator {
  user_id: string;
  added_by: string;
  created_at: Date;
}
