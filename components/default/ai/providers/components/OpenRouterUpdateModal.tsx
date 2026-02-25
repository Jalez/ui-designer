"use client";

import { Check, RefreshCw, HelpCircle } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/tailwind/ui/command";
import { Button } from "@/components/tailwind/ui/button";
import { Checkbox } from "@/components/tailwind/ui/checkbox";
import { Badge } from "@/components/tailwind/ui/badge";
import { DialogTitle, DialogDescription } from "@/components/tailwind/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/tailwind/ui/tooltip";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { useNotificationStore } from "@/components/default/notifications";
import { fetchOpenRouterData } from "../service/openRouter";
import type { OpenRouterProvider, OpenRouterModel } from "../service/openRouter";

interface OpenRouterData {
  providers: OpenRouterProvider[];
  models: OpenRouterModel[];
}

interface OpenRouterUpdateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
  showProviders?: boolean;
}

export function OpenRouterUpdateModal({
  open,
  onOpenChange,
  onUpdate,
  showProviders = true,
}: OpenRouterUpdateModalProps) {
  const [data, setData] = useState<OpenRouterData | null>(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [selectedProviders, setSelectedProviders] = useState<Set<string>>(new Set());
  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"providers" | "models">(showProviders ? "providers" : "models");

  const { showSuccess, showError } = useNotificationStore();

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const result = await fetchOpenRouterData();
      setData(result);
    } catch (error) {
      console.error("Error fetching OpenRouter data:", error);
      showError("Failed to fetch data from OpenRouter");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    try {
      setUpdating(true);

      const providersById = new Map<string, OpenRouterProvider>();

      if (showProviders && selectedProviders.size > 0 && data?.providers) {
        data.providers
          .filter((provider) => selectedProviders.has(provider.id))
          .forEach((provider) => providersById.set(provider.id, provider));
      }

      const modelsToSync =
        selectedModels.size > 0 && data?.models ? data.models.filter((model) => selectedModels.has(model.id)) : [];

      if (modelsToSync.length > 0) {
        const providerIdsFromModels = new Set(modelsToSync.map((model) => model.provider).filter(Boolean) as string[]);

        if (!data?.providers) {
          throw new Error("Provider information is required to sync models. Please refresh and try again.");
        }

        data.providers
          .filter((provider) => providerIdsFromModels.has(provider.id))
          .forEach((provider) => {
            if (!providersById.has(provider.id)) {
              providersById.set(provider.id, provider);
            }
          });

        const missingProviders = Array.from(providerIdsFromModels).filter((providerId) => !providersById.has(providerId));
        if (missingProviders.length > 0) {
          throw new Error(`Missing provider data for: ${missingProviders.join(", ")}`);
        }
      }

      const providersToSync = Array.from(providersById.values());

      let providerErrors: string[] = [];
      let modelErrors: string[] = [];

      if (providersToSync.length > 0) {
        const providerResponse = await fetch("/api/ai/providers/update", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            providers: providersToSync,
          }),
        });

        const providerPayload = await providerResponse.json();

        if (!providerResponse.ok) {
          throw new Error(providerPayload?.error || "Failed to update providers");
        }

        providerErrors = providerPayload?.errors ?? [];
      }

      if (modelsToSync.length > 0) {
        const modelResponse = await fetch("/api/ai/models/update/create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            models: modelsToSync,
          }),
        });

        const modelPayload = await modelResponse.json();

        if (!modelResponse.ok) {
          throw new Error(modelPayload?.error || "Failed to update models");
        }

        modelErrors = modelPayload?.errors ?? [];
      }

      const totalErrors = [...providerErrors, ...modelErrors];

      if (totalErrors.length > 0) {
        showError(`Finished with warnings:\n${totalErrors.join("\n")}`);
      } else {
        showSuccess(`Successfully updated ${providersToSync.length} providers and ${modelsToSync.length} models`);
      }

      onUpdate();
      onOpenChange(false);
      setSelectedProviders(new Set());
      setSelectedModels(new Set());
    } catch (error) {
      console.error("Error updating:", error);
      showError("Failed to update selected items");
    } finally {
      setUpdating(false);
    }
  };

  const toggleProvider = (providerId: string) => {
    const newSelected = new Set(selectedProviders);
    if (newSelected.has(providerId)) {
      newSelected.delete(providerId);
    } else {
      newSelected.add(providerId);
    }
    setSelectedProviders(newSelected);
  };

  const toggleModel = (modelId: string) => {
    const newSelected = new Set(selectedModels);
    if (newSelected.has(modelId)) {
      newSelected.delete(modelId);
    } else {
      newSelected.add(modelId);
    }
    setSelectedModels(newSelected);
  };

  const selectAllProviders = () => {
    if (!showProviders) {
      return;
    }
    if (data?.providers) {
      setSelectedProviders(new Set(data.providers.map((p) => p.id)));
    }
  };

  const selectAllModels = () => {
    if (data?.models) {
      setSelectedModels(new Set(data.models.map(m => m.id)));
    }
  };

  const clearSelection = () => {
    setSelectedProviders(new Set());
    setSelectedModels(new Set());
  };

  const selectedCount = (showProviders ? selectedProviders.size : 0) + selectedModels.size;

  return (
    <TooltipProvider>
      <CommandDialog open={open} onOpenChange={onOpenChange}>
        <DialogTitle className="sr-only">Update from OpenRouter</DialogTitle>
        <DialogDescription className="sr-only">
          {showProviders ? "Select providers and models to add or update" : "Select models to add or update"}
        </DialogDescription>
        <div className="flex h-full max-h-[80vh] flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">Update from OpenRouter</h2>
            <p className="text-sm text-muted-foreground">
              {showProviders ? "Select providers and models to add or update" : "Select models to add or update"}
            </p>
          </div>
          {selectedCount > 0 && (
            <Badge variant="secondary">{selectedCount} selected</Badge>
          )}
        </div>

        {/* Tabs */}
        {showProviders ? (
          <div className="flex border-b">
            <button
              className={`flex-1 px-6 py-3 text-sm font-medium ${
                activeTab === "providers"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setActiveTab("providers")}
            >
              Providers ({data?.providers.length || 0})
            </button>
            <button
              className={`flex-1 px-6 py-3 text-sm font-medium ${
                activeTab === "models"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setActiveTab("models")}
            >
              Models ({data?.models.length || 0})
            </button>
          </div>
        ) : (
          <div className="border-b px-6 py-3 text-sm font-medium text-primary">Models</div>
        )}

        {/* Action buttons */}
        <div className="flex items-center justify-between border-b px-6 py-2">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={activeTab === "providers" ? selectAllProviders : selectAllModels}
            >
              Select All
            </Button>
            <Button variant="outline" size="sm" onClick={clearSelection}>
              Clear
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Content */}
        <Command className="flex-1 overflow-hidden">
          <CommandInput placeholder={`Search ${activeTab}...`} />
          <CommandList className="max-h-none">
            <CommandEmpty>No {activeTab} found.</CommandEmpty>

            {activeTab === "providers" && data?.providers && (
              <CommandGroup>
                {data.providers.map((provider) => (
                  <CommandItem
                    key={provider.id}
                    className="flex items-center gap-3 p-3"
                    onSelect={() => toggleProvider(provider.id)}
                  >
                    <Checkbox
                      checked={selectedProviders.has(provider.id)}
                      onCheckedChange={() => toggleProvider(provider.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{provider.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {provider.id}
                        </Badge>
                      </div>
                      {provider.description && (
                        <p className="text-sm text-muted-foreground truncate mt-1">
                          {provider.description}
                        </p>
                      )}
                      {provider.models && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {provider.models.length} models available
                        </p>
                      )}
                    </div>
                    {selectedProviders.has(provider.id) && (
                      <Check className="h-4 w-4 text-green-600" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {activeTab === "models" && data?.models && (
              <CommandGroup>
                {data.models.map((model) => (
                  <CommandItem
                    key={model.id}
                    className="flex items-center gap-3 p-3"
                    onSelect={() => toggleModel(model.id)}
                  >
                    <Checkbox
                      checked={selectedModels.has(model.id)}
                      onCheckedChange={() => toggleModel(model.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{model.name || model.id}</span>
                        {model.description && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <HelpCircle className="h-4 w-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipPrimitive.Portal>
                              <TooltipContent 
                                side="bottom" 
                                align="start" 
                                sideOffset={8} 
                                collisionPadding={24}
                                avoidCollisions={true}
                                className="max-w-xs"
                                style={{ zIndex: 10002 }}
                              >
                                <p>{model.description}</p>
                              </TooltipContent>
                            </TooltipPrimitive.Portal>
                          </Tooltip>
                        )}
                        {model.provider && (
                          <Badge variant="outline" className="text-xs">
                            {model.provider}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {model.context_length && (
                          <span className="text-xs text-muted-foreground">
                            Context: {model.context_length.toLocaleString()} tokens
                          </span>
                        )}
                        {model.pricing?.prompt && (
                          <span className="text-xs text-muted-foreground">
                            ${(model.pricing.prompt * 1000000).toFixed(2)}/1M prompt
                          </span>
                        )}
                        {model.pricing?.completion && (
                          <span className="text-xs text-muted-foreground">
                            ${(model.pricing.completion * 1000000).toFixed(2)}/1M completion
                          </span>
                        )}
                        {model.pricing?.image && (
                          <span className="text-xs text-muted-foreground">
                            ${(model.pricing.image * 1000).toFixed(2)}/1K image
                          </span>
                        )}
                        {model.pricing?.request && (
                          <span className="text-xs text-muted-foreground">
                            ${(model.pricing.request * 1000).toFixed(2)}/1K request
                          </span>
                        )}
                        {model.modalities && model.modalities.length > 0 && (
                          <div className="flex gap-1">
                            {model.modalities.map((modality) => (
                              <Badge key={modality} variant="secondary" className="text-xs">
                                {modality}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    {selectedModels.has(model.id) && (
                      <Check className="h-4 w-4 text-green-600" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>

        {/* Footer */}
        <div className="flex items-center justify-between border-t px-6 py-4">
          <div className="text-sm text-muted-foreground">
            {selectedCount > 0 ? `${selectedCount} items selected` : "Select items to update"}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={selectedCount === 0 || updating}>
              {updating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                `Update ${selectedCount} Items`
              )}
            </Button>
          </div>
        </div>
      </div>
      </CommandDialog>
    </TooltipProvider>
  );
}
