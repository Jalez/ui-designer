'use client';

import Editors from "./Editors/Editors";
import { ArtBoards } from "./ArtBoards/ArtBoards";
import { DrawboardNavbarCaptureProvider } from "./ArtBoards/DrawboardNavbarCaptureContext";
import { LevelUpdater } from "./General/LevelUpdater";
import { GameContainer } from "./General/GameContainer";
import { useAppSelector } from "@/store/hooks/hooks";
import { useState, useRef } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { Footer } from "./Footer/Footer";
import { Navbar } from "./Navbar/Navbar";
import { ProgressionSync } from "./General/ProgressionSync";
import { ProgressPersistence } from "./General/ProgressPersistence";
import { LevelMetaSync } from "./General/LevelMetaSync";
import { GameplayTelemetryTracker } from "./General/GameplayTelemetryTracker";
import { GameboardTourController } from "./General/GameboardTourController";
import { useGameStore } from "./default/games";
import { useSession } from "next-auth/react";
import { useOptionalCollaboration } from "@/lib/collaboration/CollaborationProvider";
import { stripBasePath } from "@/lib/apiUrl";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { CreatorAiChatDrawer } from "@/components/creator-ai/CreatorAiChatDrawer";
import { GameProvider } from "@/components/ArtBoards/GameContext";
import { LevelProvider } from "@/components/ArtBoards/LevelContext";
import { ScenarioProvider } from "@/components/ArtBoards/ScenarioContext";
import { useIsCreatorRoute } from "@/hooks/useIsCreatorRoute";
import { useGameUrlSync } from "@/components/_hooks/useGameUrlSync";
import { useGameResponsiveLayout } from "@/components/_hooks/useGameResponsiveLayout";
import { useLtiHeightSync } from "@/components/_hooks/useLtiHeightSync";
import { useGameLevelBootstrap } from "@/components/_hooks/useGameLevelBootstrap";
const STABLE_LAYOUT_GROUP_ID = "game-layout-stable";

function App() {
  const levels = useAppSelector((state) => state.levels);
  const currentLevel = useAppSelector((state) => state.currentLevel.currentLevel);
  const [isLoading, setIsLoading] = useState(true);
  const currentGame = useGameStore((state) => {
    const { currentGameId, games } = state;
    if (!currentGameId) return null;
    return games.find((g) => g.id === currentGameId) ?? null;
  });
  const { data: session } = useSession();
  const collaboration = useOptionalCollaboration();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const normalizedPathname = stripBasePath(pathname);
  const isCreatorRoute = useIsCreatorRoute();
  const canEditCurrentGame = Boolean(currentGame?.canEdit ?? currentGame?.isOwner);
  /** Sidebar host for creator workbench only; game route editors use navbar menus instead. */
  const showEditorWorkbenchSidebar =
    canEditCurrentGame && isCreatorRoute;
  const params = useParams<{ gameId?: string }>();
  const routeGameIdParam = params?.gameId;
  const routeGameId = Array.isArray(routeGameIdParam) ? routeGameIdParam[0] : routeGameIdParam;
  const restoredRouteProgressScopeRef = useRef<string | null>(null);
  const setIsLoadingAsync = (value: boolean) => {
    queueMicrotask(() => setIsLoading(value));
  };
  const isRouteWithProgress = isCreatorRoute || normalizedPathname.startsWith("/game/");
  const {
    activeLayout,
    contentRowRef,
    editorPanelRef,
    groupOrientation,
    isEditorCollapsed,
    panelGroupRef,
    setIsEditorCollapsed,
    shouldStackGameLayout,
    toggleEditorPanel,
  } = useGameResponsiveLayout({
    collaboration,
    currentLevel,
    isLoading,
    levels,
  });

  useGameUrlSync({
    currentLevel,
    isRouteWithProgress,
    levelsLength: levels.length,
    normalizedPathname,
    routeGameId,
    router,
    searchParams,
    restoredRouteProgressScopeRef,
  });
  const { isWaitingForSharedCode } = useGameLevelBootstrap({
    currentGame,
    collaboration,
    normalizedPathname,
    routeGameId,
    router,
    searchParams,
    session: session ?? null,
    setIsLoadingAsync,
  });

  useLtiHeightSync(isLoading);

  return (
    <>
      <ProgressionSync />
      <ProgressPersistence />
      <LevelMetaSync />
      <GameplayTelemetryTracker />
      <article id="App" className="flex h-full min-h-0 flex-col justify-start">
        <LevelUpdater />
        <div className="flex-1 min-h-0">
          <GameContainer>
            {isLoading || isWaitingForSharedCode ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center space-y-4">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                  <p className="text-muted-foreground">
                    {isWaitingForSharedCode ? "Syncing shared code..." : "Loading levels..."}
                  </p>
                </div>
              </div>
            ) : levels.length > 0 ? (
              <GameProvider>
              <LevelProvider>
              <ScenarioProvider>
              <DrawboardNavbarCaptureProvider>
                <GameboardTourController />
                <Navbar />
                <div
                  ref={contentRowRef}
                  className="relative flex w-full flex-1 items-stretch overflow-hidden"
                >
                  {showEditorWorkbenchSidebar ? (
                    <div
                      id="creator-workbench-sidebar-root"
                      className="flex h-full max-h-full min-h-0 flex-none shrink-0 flex-col overflow-hidden"
                    />
                  ) : null}
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                    <ResizablePanelGroup
                      id={STABLE_LAYOUT_GROUP_ID}
                      groupRef={panelGroupRef}
                      orientation={groupOrientation}
                      defaultLayout={activeLayout.defaultLayout}
                      onLayoutChanged={activeLayout.onLayoutChanged}
                      className="h-full w-full"
                    >
                    <ResizablePanel
                      id="artboards"
                      defaultSize={shouldStackGameLayout ? 56 : 60}
                      minSize={shouldStackGameLayout ? 28 : 38}
                      className="min-h-0 min-w-0"
                    >
                      <div className="flex h-full w-full min-h-0 min-w-0 items-center justify-center overflow-hidden">
                        <ArtBoards />
                      </div>
                    </ResizablePanel>
                    <ResizableHandle
                      withHandle
                      groupOrientation={groupOrientation}
                      isPanelCollapsed={isEditorCollapsed}
                      onTogglePanel={toggleEditorPanel}
                    />
                    <ResizablePanel
                      id="editor"
                      panelRef={editorPanelRef}
                      collapsible
                      collapsedSize={0}
                      minSize={shouldStackGameLayout ? 20 : 24}
                      defaultSize={shouldStackGameLayout ? 44 : 40}
                      onResize={(panelSize) => setIsEditorCollapsed(panelSize.asPercentage === 0)}
                      className="min-h-0 min-w-0"
                    >
                      <div className="flex h-full w-full min-h-0 min-w-0 overflow-hidden">
                        <Editors />
                      </div>
                    </ResizablePanel>
                  </ResizablePanelGroup>
                  </div>
                </div>
                <Footer />
                <CreatorAiChatDrawer />
              </DrawboardNavbarCaptureProvider>
              </ScenarioProvider>
              </LevelProvider>
              </GameProvider>
            ) : null}
          </GameContainer>
        </div>
      </article>
    </>
  );
}

export default App;
