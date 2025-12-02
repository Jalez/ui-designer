// Re-export types from shared file
export * from "./types";

// Re-export all CRUD operations
import * as create from "./create";
import * as del from "./delete";
import * as read from "./read";

// Re-export individual functions for backward compatibility
export { isAdmin, getAllAdmins, getAdminDetails } from "./read";
export { addAdmin } from "./create";
export { removeAdmin } from "./delete";

// Export a simple accessor function for consistency with other services
export const getAdminService = () => ({
  isAdmin: read.isAdmin,
  getAllAdmins: read.getAllAdmins,
  getAdminDetails: read.getAdminDetails,
  addAdmin: create.addAdmin,
  removeAdmin: del.removeAdmin,
});
