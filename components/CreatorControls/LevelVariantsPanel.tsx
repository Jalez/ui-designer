"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { addLevelVariant, removeLevelVariantById, setActiveLevelVariant } from "@/store/slices/levels.slice";
import { BASE_LEVEL_VARIANT_ID } from "@/lib/levels/variants";
import { useOptionalCollaboration } from "@/lib/collaboration/CollaborationProvider";
import { useLevelMetaSync } from "@/lib/collaboration/hooks/useLevelMetaSync";
import type { EditorType } from "@/lib/collaboration/types";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

function writeYText(nextContent: string, text: { toString(): string; delete: (index: number, length: number) => void; insert: (index: number, content: string) => void; doc?: { transact: (fn: () => void, origin?: unknown) => void } } | null) {
  if (!text || text.toString() === nextContent) {
    return;
  }

  const applyChange = () => {
    text.delete(0, text.toString().length);
    if (nextContent.length > 0) {
      text.insert(0, nextContent);
    }
  };

  if (text.doc) {
    text.doc.transact(applyChange, "variant-switch");
    return;
  }

  applyChange();
}

export function LevelVariantsPanel() {
  const dispatch = useAppDispatch();
  const currentLevel = useAppSelector((state) => state.currentLevel.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const collaboration = useOptionalCollaboration();
  const { syncLevelFields } = useLevelMetaSync();
  const canMutateSharedState = collaboration?.sessionRole !== "readonly";

  useEffect(() => {
    if (!level || !canMutateSharedState) {
      return;
    }

    const templateEditors: EditorType[] = ["html", "css", "js"];
    for (const editorType of templateEditors) {
      writeYText(level.code[editorType], collaboration?.getYText?.(editorType, currentLevel - 1) ?? null);
      writeYText(level.solution[editorType], collaboration?.getYSolutionText?.(editorType, currentLevel - 1) ?? null);
    }
  }, [
    collaboration,
    canMutateSharedState,
    currentLevel,
    level?.activeVariantId,
    level?.code.css,
    level?.code.html,
    level?.code.js,
    level?.solution.css,
    level?.solution.html,
    level?.solution.js,
  ]);

  if (!level) {
    return null;
  }

  const activeVariantId = level.activeVariantId ?? BASE_LEVEL_VARIANT_ID;
  const variants = level.variants ?? [];
  const canDeleteActiveVariant =
    activeVariantId !== BASE_LEVEL_VARIANT_ID
    && variants.some((variant) => variant.id === activeVariantId);

  return (
    <div className="flex w-full flex-col gap-1 px-0.5" data-tour-spot="creator.variants">
      <div className="flex flex-col gap-0.5">
        <Button
          type="button"
          variant={activeVariantId === BASE_LEVEL_VARIANT_ID ? "secondary" : "ghost"}
          size="sm"
          className="w-full justify-center whitespace-normal border-0 px-1 py-1 text-[11px] shadow-none"
          onClick={() => dispatch(setActiveLevelVariant({ levelId: currentLevel, variantId: BASE_LEVEL_VARIANT_ID }))}
          disabled={!canMutateSharedState}
        >
          Base
        </Button>
        {variants.map((variant, index) => (
          <Button
            key={variant.id}
            type="button"
            variant={activeVariantId === variant.id ? "secondary" : "ghost"}
            size="sm"
            className={cn(
              "w-full justify-center whitespace-normal border-0 px-1 py-1 text-[11px] shadow-none",
              activeVariantId !== variant.id && "text-muted-foreground",
            )}
            onClick={() => dispatch(setActiveLevelVariant({ levelId: currentLevel, variantId: variant.id }))}
            title={variant.name}
            disabled={!canMutateSharedState}
          >
            {index + 1}
          </Button>
        ))}
      </div>
      <div className="mt-1 flex w-full flex-col gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto w-full flex-col justify-center whitespace-normal border-0 px-0.5 py-1 font-normal leading-tight shadow-none"
          onClick={() => {
            dispatch(addLevelVariant({ levelId: currentLevel }));
            syncLevelFields(currentLevel - 1, ["variants"]);
          }}
          title="Add variant"
          disabled={!canMutateSharedState}
        >
          <span className="w-full min-w-0 max-w-full text-balance text-center text-[clamp(8px,22cqw,11px)] font-medium uppercase leading-snug tracking-[0.06em] text-muted-foreground break-words [overflow-wrap:anywhere]">
            Add
          </span>
          <Plus className="h-3.5 w-3.5 shrink-0" />
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex w-full">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto w-full flex-col justify-center whitespace-normal border-0 px-0.5 py-1 font-normal leading-tight shadow-none text-destructive hover:text-destructive"
                onClick={() => {
                  if (!canDeleteActiveVariant) {
                    return;
                  }
                  dispatch(removeLevelVariantById({ levelId: currentLevel, variantId: activeVariantId }));
                  syncLevelFields(currentLevel - 1, ["variants"]);
                }}
                disabled={!canMutateSharedState || !canDeleteActiveVariant}
              >
                <span className="w-full min-w-0 max-w-full text-balance text-center text-[clamp(8px,22cqw,11px)] font-medium uppercase leading-snug tracking-[0.06em] break-words [overflow-wrap:anywhere]">
                  Delete
                </span>
                <Trash2 className="h-3.5 w-3.5 shrink-0" />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-[220px] text-[11px] leading-snug">
            {canDeleteActiveVariant ? "Delete current variant" : "Base variant cannot be removed."}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
