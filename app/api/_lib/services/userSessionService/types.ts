// User Session service types

export interface UserSession {
  session_id: string;
  key: string;
  value: string | null;
  expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserSessionOptions {
  key: string;
  value?: string | null;
  expiresAt?: Date | null;
}

export interface UpdateUserSessionOptions {
  value?: string | null;
  expiresAt?: Date | null;
}

