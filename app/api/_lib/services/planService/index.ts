// Re-export types from shared file
export * from "./types";

// Types are now defined in individual service files

// Re-export user-related operations only (plans are now managed in Stripe)
import * as read from "./read";

// Re-export individual functions for backward compatibility
export { getUserPlanInfo, getUserPlanDetails, getUserPlan, getLastActivePlan, getUsersByPlan, getUserStorageLimit } from "./read";

// Export a simple accessor function for consistency with other services
export const getPlanService = () => ({
  getUserPlanInfo: read.getUserPlanInfo,
  getUserPlanDetails: read.getUserPlanDetails,
  getUserPlan: read.getUserPlan,
  getLastActivePlan: read.getLastActivePlan,
  getUsersByPlan: read.getUsersByPlan,
  getUserStorageLimit: read.getUserStorageLimit,
});
