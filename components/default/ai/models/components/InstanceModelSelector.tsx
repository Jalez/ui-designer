"use client";

import { Coins, Sliders } from "lucide-react";
import type React from "react";
import { useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  calculateModelCredits,
  formatCredits,
} from "@/components/default/credits/utils/creditCalculator";
import { Button } from "@/components/tailwind/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/tailwind/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/tailwind/ui/tooltip";
import { useDefaultModelStore } from "..";
import { useInstanceModelStore } from "../defaults/stores/instanceModelStore";

interface ModelSelectorProps {
  isCollapsed?: boolean;
  compact?: boolean;
  documentId?: string;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({ isCollapsed = false, compact = false, documentId }) => {
  const {
    textModel: defaultTextModel,
    imageModel: defaultImageModel,
    availableTextModels,
    availableImageModels,
    setDefaultTextModel,
    setDefaultImageModel,
    fetchAvailableModels,
    loadDefaultsFromBackend,
    error,
  } = useDefaultModelStore();
  const { data: session } = useSession();
  const userId = session?.userId;

  const documentOverrides = useInstanceModelStore((state) =>
    documentId ? state.overrides[documentId]?.models : undefined,
  );
  const setInstanceModel = useInstanceModelStore((state) => state.setInstanceModel);

  // Ensure models are loaded
  useEffect(() => {
    if (availableTextModels.length === 0 && availableImageModels.length === 0) {
      fetchAvailableModels();
    }
  }, [availableTextModels.length, availableImageModels.length, fetchAvailableModels]);

  // Load user defaults from backend when authenticated
  useEffect(() => {
    if (userId && !defaultTextModel && !defaultImageModel) {
      loadDefaultsFromBackend(userId);
    }
  }, [userId, defaultTextModel, defaultImageModel, loadDefaultsFromBackend]);

  const effectiveTextModelId = documentOverrides?.textModel ?? defaultTextModel;
  const effectiveImageModelId = documentOverrides?.imageModel ?? defaultImageModel;

  // Find selected models from available models
  const selectedTextModel = availableTextModels.find((m) => m.id === effectiveTextModelId);
  const selectedImageModel = availableImageModels.find((m) => m.id === effectiveImageModelId);
  const textOverrideActive = Boolean(documentOverrides?.textModel);
  const imageOverrideActive = Boolean(documentOverrides?.imageModel);

  const handleTextModelSelection = (modelId: string) => {
    if (documentId) {
      const shouldOverride = modelId !== defaultTextModel;
      setInstanceModel(documentId, "textModel", shouldOverride ? modelId : null);
      return;
    }
    setDefaultTextModel(modelId, userId || undefined);
  };

  const handleImageModelSelection = (modelId: string) => {
    if (documentId) {
      const shouldOverride = modelId !== defaultImageModel;
      setInstanceModel(documentId, "imageModel", shouldOverride ? modelId : null);
      return;
    }
    setDefaultImageModel(modelId, userId || undefined);
  };

  const handleUseDefaultTextModel = () => {
    if (documentId) {
      setInstanceModel(documentId, "textModel", null);
    }
  };

  const handleUseDefaultImageModel = () => {
    if (documentId) {
      setInstanceModel(documentId, "imageModel", null);
    }
  };

  if (error) {
    return null; // Silently fail to not clutter the UI
  }

  return (
    <div className={compact ? "" : "w-full"}>
      <Tooltip>
        <DropdownMenu>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size={compact ? "sm" : "default"}
                className={
                  compact
                    ? "flex items-center gap-2 transition-all duration-200 bg-background text-foreground hover:bg-accent hover:text-accent-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    : `w-full h-12 p-4 rounded-none flex items-center justify-left text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800`
                }
              >
                {compact ? (
                  <>
                    <Sliders className="h-4 w-4" />
                    <span className="hidden lg:inline">AI Models</span>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-center pl-2">
                      <Sliders className="h-5 w-5" />
                    </div>
                    {!isCollapsed && (
                      <div className="flex-1 min-w-0 pl-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm whitespace-nowrap">AI Models</span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 whitespace-nowrap">
                          Configure AI models
                        </p>
                      </div>
                    )}
                  </>
                )}
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <DropdownMenuContent align="end" className="w-[300px]">
            <DropdownMenuLabel>AI Model Configuration</DropdownMenuLabel>
            <DropdownMenuSeparator />

            {/* Text Model Submenu */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <span className="flex-1">Text Generation</span>
                <span className="text-xs text-muted-foreground ml-2 truncate max-w-[180px] flex items-center gap-1">
                  {selectedTextModel ? (
                    <span className="flex items-center gap-1">
                      {selectedTextModel.name}
                      {selectedTextModel.id.startsWith("ollama/") && (
                        <span className="text-green-600 dark:text-green-400">(Local)</span>
                      )}
                    </span>
                  ) : (
                    "None"
                  )}

                </span>
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent className="w-[320px] max-h-[400px] overflow-y-auto">
                  {documentId && (
                    <>
                      <DropdownMenuItem onClick={handleUseDefaultTextModel} disabled={!textOverrideActive}>
                        Use account default
                        {selectedTextModel && (
                          <span className="ml-2 text-muted-foreground truncate">({selectedTextModel.name})</span>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  {availableTextModels.length === 0 ? (
                    <DropdownMenuItem disabled>No text models available</DropdownMenuItem>
                  ) : (
                    availableTextModels.map((model) => {
                      const isLocal = model.id.startsWith("ollama/");
                      const isSelected = model.id === effectiveTextModelId;

                      return (
                        <DropdownMenuItem
                          key={model.id}
                          onClick={() => handleTextModelSelection(model.id)}
                          className={isSelected ? "bg-accent" : ""}
                        >
                          <div className="flex items-center justify-between w-full">
                            <div className="flex flex-col gap-1 flex-1 min-w-0">
                              <span className="font-medium text-sm truncate">{model.name}</span>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                {model.context_length && (
                                  <span className="font-mono">{(model.context_length / 1000).toFixed(0)}K ctx</span>
                                )}
                                {model.pricing && (
                                  <>
                                    {isLocal ? (
                                      <span>• Free</span>
                                    ) : (
                                      <>
                                        <span>•</span>
                                        <Coins className="h-3 w-3 text-yellow-500" />
                                        <span className="font-mono">
                                          {formatCredits(calculateModelCredits(model))} credits /1M tokens
                                        </span>
                                      </>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                            {isLocal && (
                              <span className="text-xs px-1.5 py-0.5 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded ml-2 shrink-0">
                                Local
                              </span>
                            )}
                          </div>
                        </DropdownMenuItem>
                      );
                    })
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>

            {/* Image Model Submenu */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <span className="flex-1">Image Generation</span>
                <span className="text-xs text-muted-foreground ml-2 truncate max-w-[180px] flex items-center gap-1">
                  {selectedImageModel ? (
                    <span className="flex items-center gap-1">
                      {selectedImageModel.name}
                      {selectedImageModel.id.startsWith("ollama/") && (
                        <span className="text-green-600 dark:text-green-400">(Local)</span>
                      )}
                    </span>
                  ) : (
                    "None"
                  )}
                  {documentId && imageOverrideActive && (
                    <span className="text-[10px] uppercase text-primary font-semibold tracking-wide">Doc override</span>
                  )}
                </span>
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent className="w-[320px] max-h-[400px] overflow-y-auto">
                  {documentId && (
                    <>
                      <DropdownMenuItem onClick={handleUseDefaultImageModel} disabled={!imageOverrideActive}>
                        Use account default
                        {selectedImageModel && (
                          <span className="ml-2 text-muted-foreground truncate">({selectedImageModel.name})</span>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  {availableImageModels.length === 0 ? (
                    <DropdownMenuItem disabled>No image models available</DropdownMenuItem>
                  ) : (
                    availableImageModels.map((model) => {
                      const isLocal = model.id.startsWith("ollama/");
                      const isSelected = model.id === effectiveImageModelId;

                      return (
                        <DropdownMenuItem
                          key={model.id}
                          onClick={() => handleImageModelSelection(model.id)}
                          className={isSelected ? "bg-accent" : ""}
                        >
                          <div className="flex items-center justify-between w-full">
                            <div className="flex flex-col gap-1 flex-1 min-w-0">
                              <span className="font-medium text-sm truncate">{model.name}</span>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                {model.context_length && (
                                  <span className="font-mono">{(model.context_length / 1000).toFixed(0)}K ctx</span>
                                )}
                                {model.pricing && (
                                  <>
                                    {isLocal ? (
                                      <span>• Free</span>
                                    ) : (
                                      <>
                                        <span>•</span>
                                        <Coins className="h-3 w-3 text-yellow-500" />
                                        <span className="font-mono">
                                          {formatCredits(calculateModelCredits(model))} credits /image
                                        </span>
                                      </>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                            {isLocal && (
                              <span className="text-xs px-1.5 py-0.5 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded ml-2 shrink-0">
                                Local
                              </span>
                            )}
                          </div>
                        </DropdownMenuItem>
                      );
                    })
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
          </DropdownMenuContent>
          {(isCollapsed || compact) && (
            <TooltipContent side={compact ? "bottom" : "right"} className={compact ? "" : "ml-2"}>
              <p>AI Model Settings</p>
            </TooltipContent>
          )}
        </DropdownMenu>
      </Tooltip>
    </div>
  );
};
