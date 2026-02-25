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
}
