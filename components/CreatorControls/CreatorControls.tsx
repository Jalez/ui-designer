'use client';

import { useAppSelector } from "@/store/hooks/hooks";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Settings, Trash2, Save, Plus, Sparkles, Pencil, Map } from "lucide-react";
import { useRef } from "react";
import { useLevelRemover } from "./hooks/useLevelRemover";
import { useLevelSaver } from "./hooks/useLevelSaver";
import { useNewLevel } from "./hooks/useNewLevel";
import MagicButton, { MagicButtonRef } from "./UniversalMagicButton";
import MapEditor, { MapEditorRef } from "./MapEditor";

const CreatorControls = () => {
  const options = useAppSelector((state) => state.options);
  const isCreator = options.creator;
  const { handleRemove } = useLevelRemover();
  const { handleSave } = useLevelSaver();
  const { handleNewLevelCreation } = useNewLevel();
  const magicButtonRef = useRef<MagicButtonRef>(null);
  const mapEditorRef = useRef<MapEditorRef>(null);

  if (!isCreator) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" title="Creator Tools">
            <Settings className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={handleRemove}>
            <Trash2 className="h-4 w-4 mr-2" />
            Remove Level
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Save Level
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleNewLevelCreation}>
            <Plus className="h-4 w-4 mr-2" />
            Create Level
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => magicButtonRef.current?.triggerGenerate()}>
            <Sparkles className="h-4 w-4 mr-2" />
            Generate Level
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => magicButtonRef.current?.triggerEditor()}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit Generator Prompt
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => mapEditorRef.current?.triggerOpen()}>
            <Map className="h-4 w-4 mr-2" />
            Game Maps
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {/* Render dialog components without buttons */}
      <MagicButton ref={magicButtonRef} renderButton={false} />
      <MapEditor ref={mapEditorRef} renderButton={false} />
    </>
  );
};

export default CreatorControls;
