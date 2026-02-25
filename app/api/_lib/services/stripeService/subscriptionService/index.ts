// Re-export types from shared file
export * from "./types";

// Re-export all CRUD operations
import * as create from "./create";
import * as read from "./read";
import * as update from "./update";
import * as del from "./delete";

// Re-export individual functions for backward compatibility
export { createFreeSubscription, createPaidSubscription } from "./create";
export { getSubscriptionData, getBillingHistory } from "./read";
export { updateUserSubscription } from "./update";
export { cancelUserSubscription } from "./delete";

// Export a simple accessor function for consistency with other services
export const getSubscriptionService = () => ({
  createFreeSubscription: create.createFreeSubscription,
  createPaidSubscription: create.createPaidSubscription,
  getSubscriptionData: read.getSubscriptionData,
  getBillingHistory: read.getBillingHistory,
  updateUserSubscription: update.updateUserSubscription,
  cancelUserSubscription: del.cancelUserSubscription,
});
