"use client";

import { Check, Coins } from "lucide-react";
import { Badge } from "@/components/tailwind/ui/badge";
import { TableCell, TableRow } from "@/components/tailwind/ui/table";
import { cn } from "@/lib/utils";
import { calculateImageGenerationCredits, calculateTextCompletionCredits, formatCredits } from "../../credits/utils/creditCalculator";
import { ModelSelector } from "./ServiceDefaultModelSelector";
import type { Service } from "./ServiceTable";
import type { ModelPricing } from "../models/types";

interface ServiceRowProps {
    service: Service;
}

export function ServiceRow({ service }: ServiceRowProps) {
    const available = service.isActive;

    const getCreditCostForSelectedModel = (): string => {
        if (!service.currentDefaultModel) {
            return "No model selected";
        }

        const selectedModel = service.availableModels.find((m: any) => m.id === service.currentDefaultModel);
        if (!selectedModel || !('pricing' in selectedModel)) {
            return "Pricing unavailable";
        }

        try {
            const price = selectedModel.pricing[service.pricingType];
            if (!price || typeof price !== 'string') {
                return "Pricing unavailable";
            }

            const credits = service.calculateCredits(price, selectedModel);
            const unit = getPricingUnit(service.pricingType, service.serviceCategory);
            return `${formatCredits(credits)} credits${unit}`;
        } catch (error) {
            console.error("Error calculating credits:", error);
            return "Error calculating";
        }
    };

    const getPricingUnit = (pricingType: keyof ModelPricing, serviceCategory: string): string => {
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

    return (
        <TableRow className={cn(!available && "opacity-50")}>
            <TableCell className="font-medium text-gray-900 dark:text-white">
                <div className="flex items-center gap-2">
                    {available && <Check className="h-4 w-4 text-green-500" />}
                    <span>{service.serviceName}</span>
                </div>
            </TableCell>
            <TableCell className="text-gray-600 dark:text-gray-400">
                <span className="text-sm">{service.serviceDescription}</span>
            </TableCell>
            <TableCell>
                <div className="flex items-center gap-1 text-gray-900 dark:text-white">
                    <Coins className="h-4 w-4 text-yellow-500" />
                    <span className="font-mono text-sm">
                        {getCreditCostForSelectedModel()}
                    </span>
                </div>
            </TableCell>
            <TableCell>
                <Badge variant={available ? "default" : "secondary"}>{available ? "Active" : "Disabled"}</Badge>
            </TableCell>
            <TableCell>
                <ModelSelector
                    serviceName={service.serviceName}
                    availableModels={service.availableModels}
                    currentDefaultModel={service.currentDefaultModel}
                    onModelChange={service.onModelChange}
                    available={available}
                    pricingType={service.pricingType}
                    calculateCredits={service.calculateCredits}
                    serviceCategory={service.serviceCategory}
                />
            </TableCell>
        </TableRow>
    );
}
