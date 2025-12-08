"use client";

import { Loader2 } from "lucide-react";
import type React from "react";
import { ProjectAccordionItem } from "./ProjectAccordionItem";
import type { Project } from "./types";

interface ProjectsListProps {
  projects: Project[];
  isLoading: boolean;
  creatingProjectId: string | null;
  isCollapsed: boolean;
  editingId: string | null;
  editTitle: string;
  setEditTitle: (title: string) => void;
  onProjectClick?: () => void;
  getProjectTitle: (project: Project) => string;
  isActive: (projectId: string) => boolean;
  handleKeyPress: (e: React.KeyboardEvent, projectId: string) => void;
  handleCancelEdit: (projectId?: string) => void;
  handleStartEdit: (e: React.MouseEvent, projectId: string, currentTitle: string) => void;
  handleDeleteProject: (e: React.MouseEvent, projectId: string) => Promise<void>;
}

export const ProjectsList: React.FC<ProjectsListProps> = ({
  projects,
  isLoading,
  creatingProjectId,
  isCollapsed,
  editingId,
  editTitle,
  setEditTitle,
  onProjectClick,
  getProjectTitle,
  isActive,
  handleKeyPress,
  handleCancelEdit,
  handleStartEdit,
  handleDeleteProject,
}) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-12 w-full">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="flex items-center justify-center h-12 w-full text-sm text-muted-foreground">
        No projects yet
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full max-h-[400px] overflow-y-auto">
      {projects.map((project) => {
        const projectTitle = getProjectTitle(project);
        const active = isActive(project.id);
        const isEditing = editingId === project.id;
        const projectIsLoading = project.id === creatingProjectId;

        return (
          <ProjectAccordionItem
            key={project.id}
            project={project}
            projectTitle={projectTitle}
            active={active}
            isEditing={isEditing}
            isLoading={projectIsLoading}
            isCollapsed={isCollapsed}
            onProjectClick={onProjectClick}
            editTitle={editTitle}
            setEditTitle={setEditTitle}
            handleKeyPress={handleKeyPress}
            handleCancelEdit={handleCancelEdit}
            handleStartEdit={handleStartEdit}
            handleDeleteProject={handleDeleteProject}
          />
        );
      })}
    </div>
  );
};



