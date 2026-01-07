// Admin utility functions for client-side admin checks
// This mirrors the server-side admin logic for consistency

// Note: Admin emails are stored server-side only for security
// We'll check admin status by attempting to access admin routes

export async function checkAdminStatus(): Promise<boolean> {
  try {
    const response = await fetch("/api/admin/check-status", {
      method: "GET",
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return data.isAdmin === true;
  } catch (error) {
    console.error("Failed to check admin status:", error);
    return false;
  }
}

export function isAdminUser(_user: { email?: string | null } | null): boolean {
  // This is a basic client-side check - in production, use server-side validation
  // For now, we'll rely on the API check above
  return false;
}
