// Re-export types from shared file
export * from "./types";

// Re-export all CRUD operations
export * from "./create";
export * from "./read";
export * from "./update";
export * from "./delete";
export * from "./initialize";

// Legacy UserService namespace object for backward compatibility
import * as create from "./create";
import * as read from "./read";
import * as update from "./update";
import * as del from "./delete";
import * as init from "./initialize";

export const UserService = {
  // Create operations
  getOrCreateUserByEmail: create.getOrCreateUserByEmail,

  // Read operations
  getUserById: read.getUserById,
  getUserByEmail: read.getUserByEmail,
  getUserEmail: read.getUserEmail,
  getAllUsers: read.getAllUsers,

  // Update operations
  updateUserProfile: update.updateUserProfile,
  updateUserStripeCustomerId: update.updateUserStripeCustomerId,
  promoteUserToAdmin: update.promoteUserToAdmin,
  demoteUserFromAdmin: update.demoteUserFromAdmin,

  // Delete operations
  deleteUser: del.deleteUser,

  // Initialize operations
  initializeUser: init.initializeUser,
  initializeUserCredits: init.initializeUserCredits,
  ensureUserInitialized: init.ensureUserInitialized,
  ensureUserInitializedByEmail: init.ensureUserInitializedByEmail,
};

// Export the singleton instance
export const getUserService = () => UserService;
