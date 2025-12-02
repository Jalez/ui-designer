export interface AdminUser {
  id: string;
  email: string;
  role: string;
  granted_by: string | null; // User ID of who granted access
  granted_by_email: string | null; // Email of who granted access (for display)
  granted_at: Date;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}
