"use client";

import { HardDrive } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/tailwind/ui/tooltip";

interface LocalModelsIndicatorProps {
    localModelsCount: number;
}

export function LocalModelsIndicator({ localModelsCount }: LocalModelsIndicatorProps) {
    if (localModelsCount === 0) return null;

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <HardDrive className="h-4 w-4 text-green-600 dark:text-green-400" />
            </TooltipTrigger>
            <TooltipContent>
                <p className="max-w-xs">
                    <strong>{localModelsCount} local Ollama model{localModelsCount > 1 ? 's' : ''} detected</strong>
                    <br />
                    These models run on your machine and are free to use. Model capabilities cannot be verified and may not support all features like vision processing or advanced parameters.
                </p>
            </TooltipContent>
        </Tooltip>
    );
}
