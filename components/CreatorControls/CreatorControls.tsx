'use client';

import { useAppSelector } from "@/store/hooks/hooks";
import { Button } from "@/components/ui/button";
import { Trash2, Save, Plus, SlidersHorizontal, Loader2, MessageSquare } from "lucide-react";
import PoppingTitle from "@/components/General/PoppingTitle";
import { WorkbenchSidebarToolRow } from "@/components/Navbar/WorkbenchSidebarToolRow";
import { useCreatorAutosaveControls } from "./CreatorAutosaveContext";
import { useLevelRemover } from "./hooks/useLevelRemover";
import { useNewLevel } from "./hooks/useNewLevel";
import { useRouter } from "next/navigation";
import { SaveCircle } from "@/components/icons/SaveCircle";
import { useCreatorAiChatStore } from "@/components/creator-ai/store";

/** Slightly larger than default sidebar icons so circle affordances read clearly. */
const LEVELS_EMPHASIZED_ICON_CLASS =
  "!h-5 !w-5 !min-h-[1.25rem] !min-w-[1.25rem]";

type CreatorControlsDisplayMode = "icon-label" | "icon" | "sidebar";

interface CreatorControlsProps {
  displayMode?: CreatorControlsDisplayMode;
}

const CreatorControls = ({ displayMode = "icon-label" }: CreatorControlsProps) => {
  const options = useAppSelector((state) => state.options);
  const isCreator = options.mode === "creator";
  const { handleRemove } = useLevelRemover();
  const { handleSave, autoSaveEnabled, toggleAutoSave } = useCreatorAutosaveControls();
  const { handleNewLevelCreation, isCreating } = useNewLevel();
  const router = useRouter();
  const setAiChatOpen = useCreatorAiChatStore((state) => state.setOpen);

  if (!isCreator) return null;

  const inlineIconLabel = (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="sm" className="gap-2" onClick={handleNewLevelCreation} disabled={isCreating}>
        {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        {isCreating ? "Creating..." : "Create"}
      </Button>
      <Button variant="ghost" size="sm" className="gap-2" onClick={() => router.push("/account/generation")}>
        <SlidersHorizontal className="h-4 w-4" />
        Generation Settings
      </Button>
      <Button variant="ghost" size="sm" className="gap-2" onClick={() => setAiChatOpen(true)}>
        <MessageSquare className="h-4 w-4" />
        AI Chat
      </Button>
      <Button variant="ghost" size="sm" className="gap-2 text-destructive hover:text-destructive" onClick={handleRemove}>
        <Trash2 className="h-4 w-4" />
        Remove
      </Button>
      <Button variant="ghost" size="sm" className="gap-2" onClick={handleSave}>
        <Save className="h-5 w-5" />
        Save
      </Button>
      <Button variant="ghost" size="sm" className="gap-2" onClick={toggleAutoSave}>
        <SaveCircle className="h-5 w-5" />
        {autoSaveEnabled ? "Auto-save On" : "Auto-save Off"}
      </Button>
    </div>
  );

  const inlineIcons = (
    <div className="flex items-center gap-1">
      <PoppingTitle topTitle="Create Level">
        <Button variant="ghost" size="icon" onClick={handleNewLevelCreation} disabled={isCreating}>
          {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </Button>
      </PoppingTitle>
      <PoppingTitle topTitle="Generation Settings">
        <Button variant="ghost" size="icon" onClick={() => router.push("/account/generation")}>
          <SlidersHorizontal className="h-4 w-4" />
        </Button>
      </PoppingTitle>
      <PoppingTitle topTitle="AI Chat">
        <Button variant="ghost" size="icon" onClick={() => setAiChatOpen(true)}>
          <MessageSquare className="h-4 w-4" />
        </Button>
      </PoppingTitle>
      <PoppingTitle topTitle="Remove Level">
        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={handleRemove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </PoppingTitle>
      <PoppingTitle topTitle="Save Level">
        <Button variant="ghost" size="icon" onClick={handleSave}>
          <Save className="h-5 w-5" />
        </Button>
      </PoppingTitle>
      <PoppingTitle topTitle={autoSaveEnabled ? "Disable auto-save" : "Enable auto-save"}>
        <Button variant="ghost" size="icon" onClick={toggleAutoSave}>
          <SaveCircle className="h-5 w-5" />
        </Button>
      </PoppingTitle>
    </div>
  );

  const sidebar = (
    <div className="flex w-full flex-col gap-1">
      <WorkbenchSidebarToolRow
        id="level-create"
        label="Create"
        tooltip={isCreating ? "Creating level…" : "Create Level"}
        icon={isCreating ? Loader2 : Plus}
        iconClassName={isCreating ? "animate-spin" : undefined}
        onClick={handleNewLevelCreation}
        disabled={isCreating}
      />
      <WorkbenchSidebarToolRow
        id="level-remove"
        label="Remove"
        tooltip="Remove Level"
        icon={Trash2}
        onClick={handleRemove}
        destructive
      />
      <WorkbenchSidebarToolRow
        id="level-save"
        label="Save"
        tooltip="Save Level"
        icon={Save}
        onClick={handleSave}
        iconClassName={LEVELS_EMPHASIZED_ICON_CLASS}
      />
      <WorkbenchSidebarToolRow
        id="level-autosave"
        label="Auto"
        tooltip={autoSaveEnabled ? "Disable auto-save" : "Enable auto-save"}
        icon={SaveCircle}
        onClick={toggleAutoSave}
        active={autoSaveEnabled}
        iconClassName={LEVELS_EMPHASIZED_ICON_CLASS}
      />
      <div className="my-1 h-px w-full shrink-0 bg-border" aria-hidden />
      <div className="px-0.5 text-center text-[clamp(8px,20cqw,11px)] font-semibold uppercase leading-snug tracking-[0.08em] text-muted-foreground [overflow-wrap:anywhere]">
        AI
      </div>
      <WorkbenchSidebarToolRow
        id="level-gen-settings"
        label="Settings"
        tooltip="Generation Settings"
        icon={SlidersHorizontal}
        onClick={() => router.push("/account/generation")}
      />
      <WorkbenchSidebarToolRow
        id="level-ai-chat"
        label="Chat"
        tooltip="Open AI Chat"
        icon={MessageSquare}
        onClick={() => setAiChatOpen(true)}
      />
    </div>
  );

  return (
    <>
      {displayMode === "icon-label" && inlineIconLabel}
      {displayMode === "icon" && inlineIcons}
      {displayMode === "sidebar" && sidebar}
    </>
  );
};

export default CreatorControls;
