import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { useProjectStore } from "../stores/projectStore";
import { useNotificationStore } from "@/components/default/notifications";

interface UseProjectHandlersProps {
  isAuthenticated: boolean;
  onProjectClick?: () => void;
}

export const useProjectHandlers = ({ isAuthenticated, onProjectClick }: UseProjectHandlersProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const { updateProject, removeProject, addProjectToStore, createProject: createProjectInStore } = useProjectStore();
  const { showError, showSuccess, showLoading, hideNotification } = useNotificationStore();
  const [isCreating, setIsCreating] = useState(false);
  const [creatingProjectId, setCreatingProjectId] = useState<string | null>(null);
  const [loadingNotificationId, setLoadingNotificationId] = useState<string | null>(null);

  // Clear loading state when navigation completes to the created project
  useEffect(() => {
    if (creatingProjectId && pathname === `/project/${creatingProjectId}`) {
      const timer = setTimeout(() => {
        setIsCreating(false);
        setCreatingProjectId(null);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [creatingProjectId, pathname]);

  // Also clear if we navigate away from the created project
  useEffect(() => {
    if (creatingProjectId && pathname && pathname !== `/project/${creatingProjectId}` && !pathname.startsWith(`/project/${creatingProjectId}/`)) {
      setIsCreating(false);
      setCreatingProjectId(null);
    }
  }, [creatingProjectId, pathname]);

  const handleCreateProject = useCallback(async (mapName: string = "all") => {
    if (isCreating) return; // Prevent multiple clicks
    
    if (!isAuthenticated) {
      showError("Authentication required to create projects");
      return;
    }

    try {
      setIsCreating(true);
      const notificationId = showLoading("Creating project...");
      setLoadingNotificationId(notificationId);
      
      const userId = session?.userId || session?.user?.email || "";
      
      const newProject = await createProjectInStore(userId, mapName, "New Project");
      
      // Hide loading notification and show success
      if (notificationId) {
        hideNotification(notificationId);
      }
      showSuccess("Project created successfully!");
      
      // createProjectInStore already adds the project to store, no need to add again
      setCreatingProjectId(newProject.id);
      setLoadingNotificationId(null);
      router.push(`/project/${newProject.id}`);
      
      if (onProjectClick) {
        onProjectClick();
      }
    } catch (error) {
      console.error("Error creating project:", error);
      showError(error instanceof Error ? error.message : "Failed to create project");
      if (loadingNotificationId) {
        hideNotification(loadingNotificationId);
      }
      setIsCreating(false);
      setCreatingProjectId(null);
      setLoadingNotificationId(null);
    }
  }, [isAuthenticated, session, router, onProjectClick, isCreating, createProjectInStore, addProjectToStore, showError, showSuccess, showLoading, hideNotification, loadingNotificationId]);

  const handleSaveEdit = useCallback(
    async (e: React.MouseEvent, projectId: string, editTitle: string) => {
      e.stopPropagation();
      try {
        await updateProject(projectId, { title: editTitle });
      } catch (error) {
        console.error("Failed to save project title:", error);
      }
    },
    [updateProject]
  );

  const handleCancelEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handleDeleteProject = useCallback(
    async (e: React.MouseEvent, projectId: string) => {
      e.stopPropagation();
      
      if (!confirm("Are you sure you want to delete this project? This action cannot be undone.")) {
        return;
      }

      try {
        await removeProject(projectId);
        
        // If we're currently on the deleted project's page, navigate away
        if (pathname === `/project/${projectId}` || pathname?.startsWith(`/project/${projectId}/`)) {
          router.push("/");
        }
      } catch (error) {
        console.error("Failed to delete project:", error);
      }
    },
    [removeProject, pathname, router]
  );

  return {
    handleCreateProject,
    handleSaveEdit,
    handleCancelEdit,
    handleDeleteProject,
    isCreating,
    creatingProjectId,
  };
};

