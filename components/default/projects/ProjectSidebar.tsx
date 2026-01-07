"use client";

import { FolderKanban, Loader2, Plus, Search } from "lucide-react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { SidebarButton } from "../sidebar/SidebarButton";
import { SidebarLink } from "../sidebar/SidebarLink";
import { useSidebarCollapse } from "../sidebar/context/SidebarCollapseContext";
import { useProjectStore } from "./stores/projectStore";
import { ProjectsList } from "./ProjectsList";
import { useProjectHandlers } from "./hooks/useProjectHandlers";
import type { Project } from "./types";

interface SidebarProjectListProps {
  onProjectClick?: () => void;
  isUserAdmin: boolean;
}

export const ProjectSidebar: React.FC<SidebarProjectListProps> = ({ onProjectClick, isUserAdmin }) => {
  const { isCollapsed } = useSidebarCollapse();
  const pathname = usePathname();
  const { data: session } = useSession();
  const { projects, loadProjects } = useProjectStore();
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadedProjects, setHasLoadedProjects] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  const isAuthenticated = !!session?.user;

  const { handleCreateProject, handleSaveEdit, handleCancelEdit, handleDeleteProject, isCreating, creatingProjectId } = useProjectHandlers({
    isAuthenticated,
    onProjectClick,
  });

  // Load projects only when sidebar is expanded or search is opened
  useEffect(() => {
    const loadProjs = async () => {
      if (isAuthenticated && !hasLoadedProjects && session?.user?.email && (!isCollapsed || isSearchModalOpen)) {
        setIsLoading(true);
        try {
          const userId = session.userId || session.user.email;
          await loadProjects(userId);
          setHasLoadedProjects(true);
        } catch (error) {
          console.error("Error loading projects:", error);
        } finally {
          setIsLoading(false);
        }
      }
    };

    loadProjs();
  }, [isAuthenticated, hasLoadedProjects, session?.user?.email, session?.userId, loadProjects, isCollapsed, isSearchModalOpen]);

  const isActive = (projectId: string) => {
    return pathname === `/project/${projectId}`;
  };

  const getProjectTitle = (project: Project) => {
    return project.title || "Untitled Project";
  };

  const handleKeyPress = useCallback(
    async (e: React.KeyboardEvent, projectId: string) => {
      if (e.key === "Enter") {
        e.preventDefault();
        await handleSaveEdit(e as any, projectId, editTitle);
        setEditingId(null);
        setEditTitle("");
      } else if (e.key === "Escape") {
        setEditingId(null);
        setEditTitle("");
      }
    },
    [editTitle, handleSaveEdit]
  );

  const handleCancelEditWrapper = useCallback(
    async (projectId?: string) => {
      if (projectId && editTitle !== "") {
        await handleSaveEdit({} as any, projectId, editTitle);
      }
      setEditingId(null);
      setEditTitle("");
    },
    [editTitle, handleSaveEdit]
  );

  const handleStartEdit = useCallback((e: React.MouseEvent, projectId: string, currentTitle: string) => {
    e.stopPropagation();
    setEditingId(projectId);
    setEditTitle(currentTitle);
  }, []);

  const handleDeleteProjectWrapper = useCallback(
    async (e: React.MouseEvent, projectId: string) => {
      await handleDeleteProject(e, projectId);
    },
    [handleDeleteProject]
  );

  return (
    <>
      {isUserAdmin && (
        <SidebarLink
          icon={<FolderKanban className="h-5 w-5" />}
          label="Projects"
          description="Manage projects"
          href="/projects"
          onClick={onProjectClick}
          isActive={pathname === "/projects"}
          isCollapsed={isCollapsed}
          title="Projects"
        />
      )}
      
      {/* Create Project Button */}
      <SidebarButton
        icon={isCreating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
        label="New Project"
        isCollapsed={isCollapsed}
        onClick={() => handleCreateProject("all")}
        tooltip={isAuthenticated ? "New Project" : "Sign in to create projects"}
        disabled={!isAuthenticated}
      />

      {/* Projects List or Search Icon */}
      {isCollapsed ? (
        <SidebarButton
          icon={<Search className="h-5 w-5" />}
          isCollapsed={true}
          onClick={() => setIsSearchModalOpen(true)}
          tooltip="Search Projects"
        />
      ) : (
        <ProjectsList
          projects={projects}
          isLoading={isLoading}
          creatingProjectId={creatingProjectId}
          isCollapsed={isCollapsed}
          editingId={editingId}
          editTitle={editTitle}
          setEditTitle={setEditTitle}
          onProjectClick={onProjectClick}
          getProjectTitle={getProjectTitle}
          isActive={isActive}
          handleKeyPress={handleKeyPress}
          handleCancelEdit={handleCancelEditWrapper}
          handleStartEdit={handleStartEdit}
          handleDeleteProject={handleDeleteProjectWrapper}
        />
      )}
    </>
  );
};







