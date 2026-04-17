"use client";

import { Check, Eye, EyeOff, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/tailwind/ui/button";
import { Input } from "@/components/tailwind/ui/input";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { useAIProviderConfig } from "@/components/default/ai/providers/stores/aiProviderConfigStore";
import { apiUrl } from "@/lib/apiUrl";
import { cn } from "@/lib/utils";
import type { Model } from "@/components/default/ai/models/types";

function toNumber(value: string | undefined): number {
  if (!value) return 0;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function estimateModelUnitCost(model: Model): number {
  return (
    toNumber(model.pricing?.prompt) +
    toNumber(model.pricing?.completion) +
    toNumber(model.pricing?.request) +
    toNumber(model.pricing?.image) +
    toNumber(model.pricing?.internal_reasoning)
  );
}

function getProviderLabel(model: Model): string {
  return model.api_provider || model.id.split("/")[0] || "unknown";
}

function formatEstimatedCost(model: Model): string {
  const estimatedCost = estimateModelUnitCost(model);
  if (estimatedCost === 0) {
    return "Free";
  }
  return `$${estimatedCost.toExponential(2)}`;
}

function isTextCapableModel(model: Model): boolean {
  const modality = String(model.architecture?.modality || "").toLowerCase();
  return modality.includes("text") || modality.includes("chat") || modality.includes("language");
}

function supportsToolUse(model: Model): boolean {
  if (model.supportsToolUse === true) {
    return true;
  }

  const supportedParameters = Array.isArray(model.supported_parameters)
    ? model.supported_parameters.map((value) => String(value).toLowerCase())
    : [];

  return supportedParameters.includes("tools") || supportedParameters.includes("tool_choice");
}

type ValidationState = "idle" | "checking" | "valid" | "invalid";
type ValidationResponse = {
  endpointValid?: boolean;
  keyValid?: boolean;
  endpointMessage?: string;
  keyMessage?: string;
};

export function AiProviderSettingsSection() {
  const { config, setApiEndpoint, setModel, setApiKey, resetToDefaults } = useAIProviderConfig();
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [endpointValidationState, setEndpointValidationState] = useState<ValidationState>("idle");
  const [endpointValidationMessage, setEndpointValidationMessage] = useState("");
  const [apiKeyValidationState, setApiKeyValidationState] = useState<ValidationState>("idle");
  const [apiKeyValidationMessage, setApiKeyValidationMessage] = useState("");
  const isOpenRouterEndpoint = config.apiEndpoint.toLowerCase().includes("openrouter.ai");

  useEffect(() => {
    let cancelled = false;

    const loadModels = async () => {
      setLoading(true);
      setError(null);
      try {
        const url = isOpenRouterEndpoint
          ? apiUrl("/api/ai/models/read?source=openrouter")
          : apiUrl("/api/ai/models/read");
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch models: ${response.statusText}`);
        }
        const data = await response.json();
        if (!cancelled) {
          setModels(Array.isArray(data.models) ? data.models : []);
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "Failed to fetch models");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadModels().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [isOpenRouterEndpoint]);

  useEffect(() => {
    const apiEndpoint = config.apiEndpoint.trim();
    const apiKey = config.apiKey.trim();

    if (!apiEndpoint) {
      setEndpointValidationState("idle");
      setEndpointValidationMessage("Enter an API endpoint to validate it.");
      setApiKeyValidationState("idle");
      setApiKeyValidationMessage("Enter an API key to validate it.");
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setEndpointValidationState("checking");
      setEndpointValidationMessage("Checking API endpoint…");
      setApiKeyValidationState("checking");
      setApiKeyValidationMessage("Checking API key…");

      try {
        const response = await fetch(apiUrl("/api/ai/validate"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiEndpoint, apiKey }),
          signal: controller.signal,
        });

        const data = await response.json().catch(() => null) as ValidationResponse | null;
        if (!response.ok && !data) {
          throw new Error("Failed to validate AI provider settings.");
        }

        const endpointValid = Boolean(data?.endpointValid);
        const keyValid = Boolean(data?.keyValid);

        setEndpointValidationState(endpointValid ? "valid" : "invalid");
        setEndpointValidationMessage(
          data?.endpointMessage || (endpointValid ? "API endpoint is valid." : "API endpoint validation failed."),
        );
        setApiKeyValidationState(keyValid ? "valid" : "invalid");
        setApiKeyValidationMessage(
          data?.keyMessage || (keyValid ? "API key is valid." : "API key validation failed."),
        );
      } catch (error) {
        if (controller.signal.aborted) return;
        setEndpointValidationState("invalid");
        setEndpointValidationMessage(error instanceof Error ? error.message : "Failed to validate API endpoint.");
        setApiKeyValidationState("invalid");
        setApiKeyValidationMessage(error instanceof Error ? error.message : "Failed to validate API key.");
      }
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [config.apiEndpoint, config.apiKey]);

  useEffect(() => {
    setSearch("");
  }, [config.model]);

  const availableModels = useMemo(() => {
    return models
      .filter((model) => isTextCapableModel(model) && supportsToolUse(model))
      .sort((a, b) => {
        const costDiff = estimateModelUnitCost(a) - estimateModelUnitCost(b);
        if (costDiff !== 0) return costDiff;
        return a.name.localeCompare(b.name);
      });
  }, [models]);

  const modelOptions = useMemo<ComboboxOption[]>(() => {
    return availableModels.map((model) => ({
      value: model.id,
      label: model.name,
      keywords: [model.name, model.id, getProviderLabel(model), model.description || ""],
    }));
  }, [availableModels]);

  const modelsById = useMemo(() => new Map(availableModels.map((model) => [model.id, model])), [availableModels]);

  const selectedModel = models.find((model) => model.id === config.model) || null;
  const selectedModelSupportsTools = selectedModel ? supportsToolUse(selectedModel) : true;

  return (
    <div id="ai-settings" className="rounded-lg border bg-card p-6 space-y-4 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold">AI Generation Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">
          These settings are used by generation in the creator route (level + editor magic actions).
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="ai-endpoint">
          API Endpoint
        </label>
        <Input
          id="ai-endpoint"
          value={config.apiEndpoint}
          onChange={(event) => {
            setApiEndpoint(event.target.value);
            setModels([]);
            setSearch("");
          }}
          placeholder="https://openrouter.ai/api/v1"
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">Use any OpenAI-compatible endpoint.</p>
        <p
          className={cn(
            "text-xs",
            endpointValidationState === "valid" && "text-emerald-600",
            endpointValidationState === "invalid" && "text-destructive",
            (endpointValidationState === "checking" || endpointValidationState === "idle") && "text-muted-foreground",
          )}
        >
          {endpointValidationState === "checking" ? <Loader2 className="mr-1 inline h-3 w-3 animate-spin" /> : null}
          {endpointValidationMessage}
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="ai-key">
          API Key
        </label>
        <div className="relative">
          <Input
            id="ai-key"
            type={showApiKey ? "text" : "password"}
            value={config.apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="Enter API key"
            className="font-mono text-sm pr-10"
          />
          <button
            type="button"
            onClick={() => setShowApiKey((value) => !value)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={showApiKey ? "Hide API key" : "Show API key"}
            title={showApiKey ? "Hide API key" : "Show API key"}
          >
            {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <p
          className={cn(
            "text-xs",
            apiKeyValidationState === "valid" && "text-emerald-600",
            apiKeyValidationState === "invalid" && "text-destructive",
            (apiKeyValidationState === "checking" || apiKeyValidationState === "idle") && "text-muted-foreground",
          )}
        >
          {apiKeyValidationState === "checking" ? <Loader2 className="mr-1 inline h-3 w-3 animate-spin" /> : null}
          {apiKeyValidationMessage}
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="ai-model-picker">
          Model
        </label>
        <Combobox
          value={config.model}
          onValueChange={(value) => {
            setModel(value);
            setSearch("");
          }}
          options={modelOptions}
          inputValue={search}
          onInputChange={setSearch}
          isLoading={loading}
          disabled={loading || !!error || modelOptions.length === 0}
          placeholder={selectedModel ? selectedModel.id : "Choose a model"}
          searchPlaceholder="Search models..."
          emptyText={error || "No matching models."}
          loadingText="Loading models..."
          className="w-full"
          contentClassName="w-full"
          renderValue={(selected) => {
            const model = selected ? modelsById.get(selected.value) || selectedModel : selectedModel;
            if (!model) {
              return "Choose a model";
            }
            return (
              <span className="truncate font-mono text-sm">
                {model.id} · {formatEstimatedCost(model)}
              </span>
            );
          }}
          renderOption={(option, isSelected) => {
            const model = modelsById.get(option.value);
            if (!model) {
              return (
                <>
                  <Check className={cn("mr-2 h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} />
                  <span>{option.label}</span>
                </>
              );
            }

            return (
              <>
                <Check className={cn("mr-2 h-4 w-4 shrink-0", isSelected ? "opacity-100" : "opacity-0")} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{model.id}</div>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>{model.name}</span>
                    <span>{getProviderLabel(model)}</span>
                    <span>{formatEstimatedCost(model)}</span>
                    <span>{model.context_length ? `${model.context_length.toLocaleString()} ctx` : "ctx ?"}</span>
                  </div>
                </div>
              </>
            );
          }}
        />
        <p className="text-xs text-muted-foreground">
          Search models in a single combobox. {availableModels.length} tool-capable text model{availableModels.length === 1 ? "" : "s"} available.
        </p>
        {selectedModel && !selectedModelSupportsTools ? (
          <p className="text-xs text-destructive">
            The currently selected model does not advertise tool use support, so creator chat may fail until you choose a tool-capable model.
          </p>
        ) : null}
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={resetToDefaults}>
          Reset to defaults
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Stored in your browser local storage for this device.
      </p>
    </div>
  );
}
