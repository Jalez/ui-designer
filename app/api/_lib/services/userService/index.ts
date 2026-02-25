export * from "./types";
export * from "./drizzle";
export * from "./initialize";

import * as drizzle from "./drizzle";
import * as init from "./initialize";

export const UserService = {
  getOrCreateUserByEmail: drizzle.getOrCreateUserByEmail,
  getUserById: drizzle.getUserById,
  getUserByEmail: drizzle.getUserByEmail,
  getUserEmail: drizzle.getUserEmail,
  getAllUsers: drizzle.getAllUsers,
  updateUserProfile: drizzle.updateUserProfile,
  updateUserStripeCustomerId: drizzle.updateUserStripeCustomerId,
  promoteUserToAdmin: drizzle.promoteUserToAdmin,
  demoteUserFromAdmin: drizzle.demoteUserFromAdmin,
  deleteUser: drizzle.deleteUser,
  initializeUser: init.initializeUser,
  initializeUserCredits: init.initializeUserCredits,
  ensureUserInitialized: init.ensureUserInitialized,
  ensureUserInitializedByEmail: init.ensureUserInitializedByEmail,
};

export const getUserService = () => UserService;
