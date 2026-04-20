'use client';

import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { Button } from "@/components/ui/button";
import { setCurrentLevel } from "@/store/slices/currentLevel.slice";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CreatorAutosaveProvider } from "@/components/CreatorControls/CreatorAutosaveContext";
import MapEditor, { MapEditorRef } from "@/components/CreatorControls/MapEditor";
import { useSidebarCollapse } from "@/components/default/sidebar/context/SidebarCollapseContext";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useGameStore } from "@/components/default/games";
import { useOptionalCollaboration } from "@/lib/collaboration/CollaborationProvider";
import { stripBasePath } from "@/lib/apiUrl";
import { useGameplayTelemetry } from "@/components/General/useGameplayTelemetry";
import { useLevelMetaSync } from "@/lib/collaboration/hooks/useLevelMetaSync";
import { CreatorWorkbenchSubSidebar, type CreatorWorkbenchSection } from "./CreatorWorkbenchSubSidebar";
import { useEventSequenceTimelineUiStore } from "@/events/core/eventSequenceTimelineUiStore";
import { useScenarioContext } from "@/components/ArtBoards/ScenarioContext";
import { useIsCreatorRoute } from "@/hooks/useIsCreatorRoute";
import { useCreatorWorkbenchPanels } from "./useCreatorWorkbenchPanels";
import { useResetActions } from "./useResetActions";
import { useSelectedSequenceControls } from "./useSelectedSequenceControls";
import { buildWorkbenchSections, renderNavbarItems, type NavbarRegistryContext } from "./registry";

export const Navbar = () => {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { openOverlay, isMobile, isOverlayOpen, isVisible } = useSidebarCollapse();
  const pathname = usePathname();
  const normalizedPathname = stripBasePath(pathname);
  const isCreatorRoute = useIsCreatorRoute();
  const levels = useAppSelector((state) => state.levels);
  const currentLevel = useAppSelector((state) => state.currentLevel.currentLevel);
  const currentGame = useGameStore((state) => {
    if (!state.currentGameId) {
      return null;
    }

    return state.games.find((candidate) => candidate.id === state.currentGameId) ?? null;
  });
  const collaboration = useOptionalCollaboration();
  const { recordReset } = useGameplayTelemetry();
  const canEditCurrentGame = Boolean(currentGame?.canEdit ?? currentGame?.isOwner);
  const isGameRoute = normalizedPathname.startsWith("/game/");
  const isGroupGame = currentGame?.collaborationMode === "group";
  const shouldHideSidebarForPlayers = isGameRoute && Boolean(currentGame?.hideSidebar) && !canEditCurrentGame;
  const showCreatorGameMenus = isGameRoute && Boolean(currentGame?.id) && canEditCurrentGame;
  const isCreatorWorkbenchContext = isCreatorRoute && canEditCurrentGame;
  const hostEditorWorkbench = isCreatorWorkbenchContext;
  const shouldShowMobileSidebarToggle =
    isGameRoute &&
    isVisible &&
    isMobile &&
    !isOverlayOpen &&
    !shouldHideSidebarForPlayers;
  const shouldShowCreatorSidebarToggle =
    (showCreatorGameMenus || isCreatorWorkbenchContext) &&
    isVisible &&
    isMobile &&
    !isOverlayOpen;

  const level = levels[currentLevel - 1];
  const points = useAppSelector((state) => state.points);
  const { syncLevelFields } = useLevelMetaSync();
  const shouldEmphasizeFinishGame = points.allMaxPoints > 0 && points.allPoints >= points.allMaxPoints;
  const mapEditorRef = useRef<MapEditorRef>(null);
  const [hasDismissedCompactGameShake, setHasDismissedCompactGameShake] = useState(false);
  const { creatorWorkbenchPanels, setCreatorWorkbenchPanels } = useCreatorWorkbenchPanels();
  const {
    creatorPreviewInteractive: selectedSequenceScenarioInteractive,
    selectedScenarioId: selectedSequenceScenarioIdFromBoard,
    setCreatorPreviewInteractiveForScenario,
  } = useScenarioContext();
  const setPanelOpen = useEventSequenceTimelineUiStore((state) => state.setPanelOpen);

  const viewModel = useMemo(() => ({
    isCreatorWorkbenchContext,
    isGameRoute,
    shouldShowCreatorSidebarToggle,
    shouldShowMobileSidebarToggle,
    showCreatorGameMenus,
  }), [
    isCreatorWorkbenchContext,
    isGameRoute,
    shouldShowCreatorSidebarToggle,
    shouldShowMobileSidebarToggle,
    showCreatorGameMenus,
  ]);

  const {
    closeResetDialog,
    confirmReset,
    isResetDialogOpen,
    resetScope,
    toggleResetDialog,
  } = useResetActions({
    collaboration,
    currentGameId: currentGame?.id,
    currentLevel,
    dispatch,
    isGameRoute,
    recordReset,
  });

  const {
    isSequenceRecording,
    handleClearSelectedSequence,
    handleRemoveSelectedStep,
    handleSetSelectedScenarioInteractive,
    handleStartContinuousRecording,
    handleStartSingleStepRecording,
    handleStopSequenceRecording,
    selectedSequenceScenarioId,
    selectedSequenceStepIsLast,
    selectedSequenceSteps,
  } = useSelectedSequenceControls({
    currentLevel,
    dispatch,
    level,
    selectedSequenceScenarioIdFromBoard,
    selectedSequenceScenarioInteractive,
    setCreatorPreviewInteractiveForScenario,
    setPanelOpen,
    syncLevelFields,
  });

  useEffect(() => {
    if (!shouldEmphasizeFinishGame) {
      setHasDismissedCompactGameShake(false);
    }
  }, [shouldEmphasizeFinishGame]);

  const levelChanger = useCallback((pickedLevel: number) => {
    dispatch(setCurrentLevel(pickedLevel));
  }, [dispatch]);

  const openGameLobby = useCallback(() => {
    if (!currentGame?.id || !isGroupGame) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set("mode", "lobby");
    params.delete("groupId");
    const query = params.toString();
    router.push(`/game/${currentGame.id}${query ? `?${query}` : ""}`);
  }, [currentGame?.id, isGroupGame, router, searchParams]);

  const openCreatorPreview = useCallback(() => {
    if (!currentGame?.id) {
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.set("mode", "game");
    params.delete("groupId");
    router.push(`/game/${currentGame.id}?${params.toString()}`);
  }, [currentGame?.id, router, searchParams]);

  const tourSpotProps = useCallback((spot: string, slot: "mobile" | "desktop") => {
    if (slot === "mobile" && isMobile) {
      return { "data-tour-spot": spot };
    }
    if (slot === "desktop" && !isMobile) {
      return { "data-tour-spot": spot };
    }
    return {};
  }, [isMobile]);

  const registryContext = useMemo<NavbarRegistryContext>(() => ({
    canEditCurrentGame,
    creatorWorkbenchPanels,
    currentGameId: currentGame?.id,
    dismissCompactGameShake: () => setHasDismissedCompactGameShake(true),
    hasDismissedCompactGameShake,
    isCreatorRoute,
    isCreatorWorkbenchContext,
    isGameRoute,
    isGroupGame,
    isMobile,
    levelChanger,
    mapEditorRef,
    onOpenCreatorPreview: openCreatorPreview,
    onOpenGameLobby: openGameLobby,
    onOpenOverlay: openOverlay,
    onSetCreatorWorkbenchPanels: setCreatorWorkbenchPanels,
    onSwitchToCreator: () => {
      if (currentGame?.id) {
        router.push(`/creator/${currentGame.id}`);
      }
    },
    onToggleResetDialog: toggleResetDialog,
    points,
    shouldEmphasizeFinishGame,
    shouldShowCreatorSidebarToggle,
    shouldShowMobileSidebarToggle,
    showCreatorGameMenus,
    tourSpotProps,
  }), [
    canEditCurrentGame,
    creatorWorkbenchPanels,
    currentGame?.id,
    hasDismissedCompactGameShake,
    isCreatorRoute,
    isCreatorWorkbenchContext,
    isGameRoute,
    isGroupGame,
    isMobile,
    levelChanger,
    openCreatorPreview,
    openGameLobby,
    openOverlay,
    setCreatorWorkbenchPanels,
    toggleResetDialog,
    points,
    shouldEmphasizeFinishGame,
    shouldShowCreatorSidebarToggle,
    shouldShowMobileSidebarToggle,
    showCreatorGameMenus,
    tourSpotProps,
    router,
  ]);

  const creatorWorkbenchSections = useMemo((): CreatorWorkbenchSection[] => (
    buildWorkbenchSections(registryContext, {
      isSequenceRecording,
      onClearSelectedSequence: handleClearSelectedSequence,
      onRemoveSelectedStep: handleRemoveSelectedStep,
      onSetInteractive: handleSetSelectedScenarioInteractive,
      onStartContinuousRecording: handleStartContinuousRecording,
      onStartSingleStepRecording: handleStartSingleStepRecording,
      onStopSequenceRecording: handleStopSequenceRecording,
      selectedSequenceScenarioId,
      selectedSequenceScenarioInteractive,
      selectedSequenceStepIsLast,
      selectedSequenceStepsLength: selectedSequenceSteps.length,
    }).map((section) => section.build(registryContext))
  ), [
    registryContext,
    handleClearSelectedSequence,
    handleRemoveSelectedStep,
    handleSetSelectedScenarioInteractive,
    handleStartContinuousRecording,
    handleStartSingleStepRecording,
    handleStopSequenceRecording,
    isSequenceRecording,
    selectedSequenceScenarioId,
    selectedSequenceScenarioInteractive,
    selectedSequenceStepIsLast,
    selectedSequenceSteps.length,
  ]);

  const [creatorWorkbenchSidebarHost, setCreatorWorkbenchSidebarHost] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (!hostEditorWorkbench) {
      setCreatorWorkbenchSidebarHost(null);
      return;
    }
    setCreatorWorkbenchSidebarHost(document.getElementById("creator-workbench-sidebar-root"));
  }, [hostEditorWorkbench]);

  if (!level) return null;

  return (
    <>
      <div className="flex w-full flex-wrap items-center justify-around gap-2 border-b bg-background/80 px-3 py-2 2xl:flex-nowrap 2xl:justify-between">
        {(viewModel.isGameRoute || viewModel.isCreatorWorkbenchContext) ? (
          <div className={`${isMobile ? "flex" : "hidden"} w-full min-w-0 items-center gap-1`}>
            <div className="flex min-w-0 flex-1 items-center gap-1">
              {viewModel.showCreatorGameMenus
                ? renderNavbarItems("compact-creator", registryContext, "mobile")
                : viewModel.isCreatorWorkbenchContext
                  ? renderNavbarItems("compact-workbench", registryContext, "mobile")
                  : renderNavbarItems("compact-player", registryContext, "mobile")}
            </div>
          </div>
        ) : null}

        <div className={`${isMobile ? "hidden" : "flex"} flex-1 min-w-0 items-center gap-1`}>
          {viewModel.showCreatorGameMenus && currentGame?.id ? (
            renderNavbarItems("compact-creator", registryContext, "desktop")
          ) : viewModel.isCreatorWorkbenchContext ? (
            renderNavbarItems("compact-workbench", registryContext, "desktop")
          ) : !isCreatorRoute && !viewModel.isGameRoute ? (
            renderNavbarItems("mode-toggle", registryContext)
          ) : null}

          {viewModel.isGameRoute && !viewModel.showCreatorGameMenus ? (
            <>
              <div className={`${isMobile ? "hidden" : "flex"} flex-1 min-w-0 items-center gap-2`}>
                {renderNavbarItems("inline-player", registryContext)}
              </div>
              <div className={`${isMobile ? "flex" : "hidden"} flex-1 min-w-0 items-center gap-1`}>
                {renderNavbarItems("compact-player", registryContext, "mobile")}
              </div>
            </>
          ) : !viewModel.showCreatorGameMenus ? (
            renderNavbarItems("default-status", registryContext)
          ) : null}
        </div>

        <MapEditor ref={mapEditorRef} renderButton={false} />
        <NavPopper
          open={isResetDialogOpen}
          paragraph={
            showCreatorGameMenus && resetScope === "game"
              ? "This resets the shared game instance for the current room back to the original template code. All saved progress for that room will be lost."
              : showCreatorGameMenus
                ? "This resets only the current level in the shared game instance back to that level's original template code."
                : "This is an irreversible action. All progress will be lost, but timer is not affected. Are you sure you want to reset the level?"
          }
          title={showCreatorGameMenus ? (resetScope === "game" ? "Reset Game" : "Reset Level") : "Reset Level"}
          handleConfirmation={confirmReset}
          resetAnchorEl={closeResetDialog}
        />
      </div>
      {hostEditorWorkbench && creatorWorkbenchSidebarHost
        ? createPortal(
            <CreatorAutosaveProvider>
              <CreatorWorkbenchSubSidebar sections={creatorWorkbenchSections} />
            </CreatorAutosaveProvider>,
            creatorWorkbenchSidebarHost,
          )
        : null}
    </>
  );
};

type NavPopperProps = {
  open: boolean;
  paragraph: string;
  title: string;
  handleConfirmation: () => void;
  resetAnchorEl?: () => void;
};

export const NavPopper = ({
  open,
  paragraph,
  title,
  handleConfirmation,
  resetAnchorEl,
}: NavPopperProps) => {
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const timer = setTimeout(() => {
      resetAnchorEl?.();
    }, 10000);

    return () => clearTimeout(timer);
  }, [open, resetAnchorEl]);

  const confirmationAndClose = () => {
    handleConfirmation();
    resetAnchorEl?.();
  };
  const handleClose = useCallback(() => resetAnchorEl?.(), [resetAnchorEl]);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          resetAnchorEl?.();
        }
      }}
    >
      <DialogContent className="z-[1200]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-[0.7rem] w-[250px]">
            {paragraph}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-2">
          <Button onClick={confirmationAndClose} variant="outline">
            Yes
          </Button>
          <Button onClick={handleClose} variant="outline">
            No
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
