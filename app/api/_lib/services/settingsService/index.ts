// Re-export types from shared file
export * from "./types";

// Re-export all CRUD operations
export * from "./create";
export * from "./read";
export * from "./update";

// Legacy DefaultsService namespace object for backward compatibility
import * as create from "./create";
import * as read from "./read";
import * as update from "./update";

export const DefaultsService = {
  // Create operations
  createUserDefaults: create.createUserDefaults,

  // Read operations
  getUserDefaults: read.getUserDefaults,

  // Update operations
  updateUserDefaults: update.updateUserDefaults,
};
