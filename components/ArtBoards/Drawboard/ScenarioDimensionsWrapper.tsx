'use client';

import { useState, type ReactNode } from "react";
import { ScenarioDimensions } from "./ScenarioDimensions";
import { scenario } from "@/types";
import { DraggableFloatingPanel } from "@/components/General/DraggableFloatingPanel";

const TOOLBAR_DEFAULT_POSITION = { x: 8, y: 8 };

type ScenarioDimensionsWrapperProps = {
  scenario: scenario;
  levelId: number;
  showDimensions: boolean;
  setShowDimensions: (show: boolean) => void;
  /** Placed in the same draggable panel as dimensions (e.g. static/interactive switch). */
  toolbarEnd?: ReactNode;
};

export const ScenarioDimensionsWrapper = ({
  scenario,
  showDimensions,
  setShowDimensions,
  toolbarEnd,
}: ScenarioDimensionsWrapperProps) => {
  const [selectOpen, setSelectOpen] = useState(false);
  const [editDimensions, setEditDimensions] = useState(false);

  const shouldShow = showDimensions || editDimensions || selectOpen;

  return (
    <>
      {shouldShow && (
        <DraggableFloatingPanel
          showOnHover={!(selectOpen || editDimensions)}
          storageKey={`drawing-toolbar-${scenario.scenarioId}`}
          defaultPosition={TOOLBAR_DEFAULT_POSITION}
        >
          <div className="flex flex-row items-center gap-3 rounded-lg border border-border/60 bg-background/85 px-3 py-2 text-foreground shadow-lg backdrop-blur-sm transition-colors hover:bg-background/95">
            <ScenarioDimensions
              scenario={scenario}
              showDimensions={shouldShow}
              setShowDimensions={setShowDimensions}
              selectOpen={selectOpen}
              setSelectOpen={setSelectOpen}
              editDimensions={editDimensions}
              setEditDimensions={setEditDimensions}
            />
            {toolbarEnd ? (
              <div
                className="shrink-0 border-l border-border/60 pl-2"
                onMouseDown={(e) => e.stopPropagation()}
              >
                {toolbarEnd}
              </div>
            ) : null}
          </div>
        </DraggableFloatingPanel>
      )}
    </>
  );
};
