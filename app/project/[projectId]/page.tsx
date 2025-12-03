'use client';

import { use, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import App from "@/components/App";
import { useProjectStore } from "@/components/default/projects";

interface ProjectPageProps {
  params: Promise<{
    projectId: string;
  }>;
}

export default function ProjectPage({ params }: ProjectPageProps) {
  const { projectId } = use(params);
  const { data: session } = useSession();
  const { loadProjectById, setCurrentProjectId, getProjectById } = useProjectStore();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeProject = async () => {
      if (!session?.user) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        
        // Check if project is already in store
        const existingProject = getProjectById(projectId);
        
        if (!existingProject) {
          // Load project from API
          const project = await loadProjectById(projectId);
          
          if (!project) {
            setError("Project not found");
            setIsLoading(false);
            return;
          }
        }
        
        // Set as current project
        setCurrentProjectId(projectId);
        setIsLoading(false);
      } catch (err) {
        console.error("Error loading project:", err);
        setError("Failed to load project");
        setIsLoading(false);
      }
    };

    initializeProject();
  }, [projectId, session, loadProjectById, setCurrentProjectId, getProjectById]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-gray-100 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading project...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 dark:text-red-400">{error}</h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Please check if the project exists and you have access to it.
          </p>
        </div>
      </div>
    );
  }

  return <App />;
}
