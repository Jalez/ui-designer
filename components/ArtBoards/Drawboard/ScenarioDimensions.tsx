'use client';

import { useState, useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { changeScenarioDimensions } from "@/store/slices/levels.slice";
import { batch } from "react-redux";
import { scenario } from "@/types";
import { secondaryColor, mainColor } from "@/constants";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import PoppingTitle from "@/components/General/PoppingTitle";

type ScenarioDimensionsProps = {
  scenario: scenario;
  levelId: number;
  showDimensions: boolean;
  setShowDimensions: (show: boolean) => void;
  selectOpen: boolean;
  setSelectOpen: (open: boolean) => void;
  editDimensions: boolean;
  setEditDimensions: (edit: boolean) => void;
  onRemoveScenario?: () => void;
};

export const ScenarioDimensions = ({
  scenario,
  levelId,
  showDimensions,
  setShowDimensions,
  selectOpen,
  setSelectOpen,
  editDimensions,
  setEditDimensions,
  onRemoveScenario,
}: ScenarioDimensionsProps): React.ReactNode => {
  const dispatch = useAppDispatch();
  const options = useAppSelector((state) => state.options);
  const isCreator = options.creator;
  
  // Get the current scenario from Redux to ensure we have the latest data
  const level = useAppSelector((state) => state.levels[levelId - 1]);
  const currentScenario = level?.scenarios?.find(
    (s) => s.scenarioId === scenario.scenarioId
  ) || scenario;
  
  // Also get level separately for finishEditing
  const levelForEditing = useAppSelector((state) => state.levels[levelId - 1]);

  const [dimensionWidth, setDimensionWidth] = useState(
    currentScenario.dimensions.width
  );
  const [dimensionHeight, setDimensionHeight] = useState(
    currentScenario.dimensions.height
  );
  const [dimensionUnit, setDimensionUnit] = useState(
    currentScenario.dimensions.unit || "px"
  );

  // Track the last values we saved to prevent overwriting with stale Redux data
  const lastSavedValuesRef = useRef<{ width: number; height: number; unit: string } | null>(null);
  
  // Sync local state with Redux scenario when it changes, but only when not editing
  // Skip sync if we just saved these exact values (to prevent overwriting with stale data)
  useEffect(() => {
    if (currentScenario && !editDimensions) {
      const currentValues = {
        width: currentScenario.dimensions.width,
        height: currentScenario.dimensions.height,
        unit: currentScenario.dimensions.unit || "px"
      };
      
      // If we just saved these values, don't overwrite local state
      if (lastSavedValuesRef.current &&
          lastSavedValuesRef.current.width === currentValues.width &&
          lastSavedValuesRef.current.height === currentValues.height &&
          lastSavedValuesRef.current.unit === currentValues.unit) {
        // These are the values we just saved, so our local state is already correct
        console.log("ScenarioDimensions: Skipping sync - values match what we just saved", currentValues);
        return;
      }
      
      console.log("ScenarioDimensions: Syncing local state with Redux", {
        from: { width: dimensionWidth, height: dimensionHeight },
        to: currentValues
      });
      
      setDimensionWidth(currentValues.width);
      setDimensionHeight(currentValues.height);
      setDimensionUnit(currentValues.unit);
    }
  }, [currentScenario?.dimensions.width, currentScenario?.dimensions.height, currentScenario?.dimensions.unit, editDimensions]);

  const widthInputRef = useRef<HTMLInputElement>(null);
  const heightInputRef = useRef<HTMLInputElement>(null);

  const handleStaticDimensionClick = () => {
    setEditDimensions(!editDimensions);
  };

  useEffect(() => {
    if (editDimensions && widthInputRef.current) {
      // Small delay to ensure the input is rendered
      setTimeout(() => {
        widthInputRef.current?.focus();
        widthInputRef.current?.select();
      }, 0);
    }
  }, [editDimensions]);

  const finishEditing = () => {
    // Get the latest values from Redux before saving to ensure we don't overwrite with stale data
    const latestScenario = levelForEditing?.scenarios?.find(
      (s) => s.scenarioId === scenario.scenarioId
    ) || scenario;
    
    // Use local state values (what user just edited), but merge with Redux to avoid overwriting
    // If Redux has a newer value for one dimension, use that instead of stale local state
    const widthToSave = dimensionWidth;
    const heightToSave = dimensionHeight;
    const unitToSave = dimensionUnit;
    
    console.log("ScenarioDimensions: Finishing editing", {
      scenarioId: scenario.scenarioId,
      localWidth: dimensionWidth,
      localHeight: dimensionHeight,
      reduxWidth: latestScenario.dimensions.width,
      reduxHeight: latestScenario.dimensions.height,
      savingWidth: widthToSave,
      savingHeight: heightToSave
    });
    
    // Save the values to Redux - dispatch both dimensions in a single action
    dispatch(
      changeScenarioDimensions({
        levelId,
        scenarioId: scenario.scenarioId,
        width: widthToSave,
        height: heightToSave,
        unit: unitToSave,
      })
    );
    
    // Remember what we just saved to prevent sync from overwriting
    lastSavedValuesRef.current = {
      width: widthToSave,
      height: heightToSave,
      unit: unitToSave
    };
    
    // Exit edit mode - local state already has the correct values
    setEditDimensions(false);
    
    // Clear the ref after a short delay to allow future syncs
    setTimeout(() => {
      lastSavedValuesRef.current = null;
    }, 500);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    finishEditing();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      finishEditing();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setEditDimensions(false);
      // Reset to original values from Redux
      setDimensionWidth(currentScenario.dimensions.width);
      setDimensionHeight(currentScenario.dimensions.height);
      setDimensionUnit(currentScenario.dimensions.unit || "px");
    }
    // Allow Tab to move between inputs
    if (e.key === 'Tab') {
      // Let default Tab behavior work
      return;
    }
  };

  const updateDimensionHeight = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDimensionHeight(+e.target.value);
  };

  const updateDimensionWidth = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDimensionWidth(+e.target.value);
  };

  const handleDimensionChange = (
    dimensionType: "width" | "height",
    value: number
  ) => {
    console.log("ScenarioDimensions: Dispatching dimension change", {
      levelId,
      scenarioId: scenario.scenarioId,
      dimensionType,
      value
    });
    dispatch(
      changeScenarioDimensions({
        levelId,
        scenarioId: scenario.scenarioId,
        dimensionType,
        value,
      })
    );
  };

  const handleUnitChange = (unit: string) => {
    dispatch(
      changeScenarioDimensions({
        levelId,
        scenarioId: scenario.scenarioId,
        dimensionType: "width",
        value: currentScenario.dimensions.width,
        unit,
      })
    );
  };

  if (!isCreator) return null;


  return (
    <>
      {(showDimensions || editDimensions || selectOpen) && (
        <div
          data-dimensions-control
          className="flex justify-center items-center flex-row gap-3 px-4 py-2"
          style={{
            color: secondaryColor,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
          }}
          onMouseEnter={() => setShowDimensions(true)}
          onMouseLeave={(e) => {
            // Don't hide if mouse is moving to parent container or scenario area
            const relatedTarget = e.relatedTarget as HTMLElement;
            const parent = e.currentTarget.closest('[data-scenario-hover-content]')?.parentElement?.parentElement;
            if (relatedTarget && parent && (relatedTarget === parent || parent.contains(relatedTarget))) {
              return;
            }
            if (!selectOpen && !editDimensions) {
              setShowDimensions(false);
            }
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {onRemoveScenario && (
            <PoppingTitle topTitle="Remove Scenario">
              <Button
                size="icon"
                variant="ghost"
                onClick={onRemoveScenario}
                className="text-destructive hover:text-destructive h-auto p-1"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </PoppingTitle>
          )}
          {!editDimensions ? (
            <div className="flex items-center gap-2">
              <div
                onClick={handleStaticDimensionClick}
                className="cursor-pointer select-none text-white font-[Kontakt] text-sm"
                style={{ color: secondaryColor }}
              >
                {currentScenario.dimensions.width} × {currentScenario.dimensions.height}
              </div>
              <Select
                value={currentScenario.dimensions.unit || "px"}
                onValueChange={(value) => {
                  setDimensionUnit(value);
                  handleUnitChange(value);
                }}
                onOpenChange={(open) => {
                  setSelectOpen(open);
                  if (open) {
                    setShowDimensions(true);
                  }
                }}
              >
                <SelectTrigger
                  className="h-auto p-0 px-1 bg-transparent border-none text-white font-[Kontakt] text-sm focus:ring-0 focus:ring-offset-0 w-auto min-w-0 [&>span]:w-auto"
                  style={{ color: secondaryColor }}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <SelectValue>
                    {currentScenario.dimensions.unit || "px"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent onCloseAutoFocus={(e) => e.preventDefault()}>
                  <SelectItem value="px">px</SelectItem>
                  <SelectItem value="cm">cm</SelectItem>
                  <SelectItem value="em">em</SelectItem>
                  <SelectItem value="rem">rem</SelectItem>
                  <SelectItem value="%">%</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex items-center gap-2" onBlur={(e) => {
              // Only finish editing if focus is moving outside the form
              const currentTarget = e.currentTarget;
              const relatedTarget = e.relatedTarget as HTMLElement;
              if (!currentTarget.contains(relatedTarget)) {
                finishEditing();
              }
            }}>
              <div className="inline-flex items-center gap-2">
                <input
                  ref={widthInputRef}
                  className="text-center bg-transparent text-white font-[Kontakt] text-sm p-0 m-0 outline-none border-none"
                  style={{ 
                    color: secondaryColor,
                    width: `${String(currentScenario.dimensions.width).length + 1}ch`,
                  }}
                  type="text"
                  inputMode="numeric"
                  value={dimensionWidth}
                  onChange={updateDimensionWidth}
                  onKeyDown={handleKeyDown}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.currentTarget.focus();
                    e.currentTarget.select();
                  }}
                />
                <span className="text-white font-[Kontakt] text-sm" style={{ color: secondaryColor }}>×</span>
                <input
                  ref={heightInputRef}
                  className="text-center bg-transparent text-white font-[Kontakt] text-sm p-0 m-0 outline-none border-none"
                  style={{ 
                    color: secondaryColor,
                    width: `${String(currentScenario.dimensions.height).length + 1}ch`,
                  }}
                  type="text"
                  inputMode="numeric"
                  value={dimensionHeight}
                  onChange={updateDimensionHeight}
                  onKeyDown={handleKeyDown}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.currentTarget.focus();
                    e.currentTarget.select();
                  }}
                />
              </div>
              <Select
                value={dimensionUnit}
                onValueChange={(value) => {
                  setDimensionUnit(value);
                  handleUnitChange(value);
                }}
                onOpenChange={(open) => {
                  setSelectOpen(open);
                }}
              >
                <SelectTrigger
                  className="h-auto p-0 px-1 bg-transparent border-none text-white font-[Kontakt] text-sm focus:ring-0 focus:ring-offset-0 w-auto min-w-0 [&>span]:w-auto"
                  style={{ color: secondaryColor }}
                >
                  <SelectValue>{dimensionUnit}</SelectValue>
                </SelectTrigger>
                <SelectContent onCloseAutoFocus={(e) => e.preventDefault()}>
                  <SelectItem value="px">px</SelectItem>
                  <SelectItem value="cm">cm</SelectItem>
                  <SelectItem value="em">em</SelectItem>
                  <SelectItem value="rem">rem</SelectItem>
                  <SelectItem value="%">%</SelectItem>
                </SelectContent>
              </Select>
            </form>
          )}
        </div>
      )}
    </>
  );
};
