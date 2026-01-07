"use client";

import { Check, ChevronsUpDown, Coins } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/tailwind/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/tailwind/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/tailwind/ui/popover";
import { cn } from "@/lib/utils";
import type { Model, ModelPricing } from "../models/types";
import { useNotificationStore } from "../../notifications";

interface BaseModel {
    id: string;
    name: string;
    provider?: string;
}

interface ModelSelectorProps {
    serviceName: string;
    availableModels: (Model | BaseModel)[];
    currentDefaultModel: string | undefined;
    onModelChange: (modelId: string) => Promise<void> | void;
    available: boolean;
    pricingType: keyof ModelPricing;
    calculateCredits: (price: string, model?: any) => number;
    serviceCategory?: string;
}

export function ModelSelector({ serviceName, availableModels, currentDefaultModel, onModelChange, available, pricingType, calculateCredits, serviceCategory }: ModelSelectorProps) {
    const [saving, setSaving] = useState(false);

    const { showSuccess, showError } = useNotificationStore();

    const getPricingUnit = (pricingType: keyof ModelPricing, serviceCategory?: string): string => {
        switch (pricingType) {
            case "prompt":
                return serviceCategory === "text_completion" ? " /1M tokens" : "";
            case "completion":
                return " /1M tokens";
            case "image":
                return " /image";
            case "request":
                return " /request";
            case "internal_reasoning":
                return " /1M tokens";
            default:
                return "";
        }
    };

    const handleModelChange = async (modelId: string) => {
        try {
            setSaving(true);
            await onModelChange(modelId);
            showSuccess(`Default ${serviceName} model updated`);
        } catch (error) {
            console.error("Error saving model preference:", error);
            showError("Failed to save model preference");
        } finally {
            setSaving(false);
        }
    };

    const [open, setOpen] = useState(false);

    if (!availableModels.length) {
        return <span className="text-sm text-gray-500 dark:text-gray-400">No models available</span>;
    }

    const selectedModel = availableModels.find((m) => m.id === currentDefaultModel);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    disabled={saving || !available}
                    className="w-[400px] justify-between"
                >
                    {selectedModel ? (
                        <span className="truncate">
                            {selectedModel.name}
                            <span className="text-xs text-gray-500 ml-2">({'provider' in selectedModel && selectedModel.provider ? selectedModel.provider : selectedModel.id.split("/")[0]})</span>
                        </span>
                    ) : (
                        "Select model..."
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[500px] p-0" align="start">
                <Command>
                    <CommandInput placeholder={`Search ${serviceName} models...`} />
                    <CommandList>
                        <CommandEmpty>No model found.</CommandEmpty>
                        <CommandGroup>
                            {availableModels.map((model) => (
                                <CommandItem
                                    key={model.id}
                                    value={model.id}
                                    keywords={[model.name, model.id, model.id.split("/")[0]]}
                                    onSelect={(value) => {
                                        handleModelChange(value);
                                        setOpen(false);
                                    }}
                                >
                                    <Check className={cn("mr-2 h-4 w-4", currentDefaultModel === model.id ? "opacity-100" : "opacity-0")} />
                                    <div className="flex-1 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">{model.name}</span>
                                            <span className="text-xs text-gray-500">({'provider' in model && model.provider ? model.provider : model.id.split("/")[0]})</span>
                                        </div>
                                        {'pricing' in model && model.pricing[pricingType] && typeof model.pricing[pricingType] === "string" && (
                                            <div className="flex items-center gap-1">
                                                <span className="text-xs font-mono text-gray-600 dark:text-gray-400">
                                                    {calculateCredits("", model)}
                                                </span>
                                                <Coins className="h-4 w-4 text-yellow-500" />
                                            </div>
                                        )}
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
