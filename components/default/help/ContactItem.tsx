"use client";

import { Copy } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ContactItemProps {
    icon: ReactNode;
    action: string;
    index: number;
}

export function ContactItem({ icon, action, index }: ContactItemProps) {
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

    const copyToClipboard = async (text: string, index: number) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedIndex(index);
            setTimeout(() => setCopiedIndex(null), 1000); // Reset after 2 seconds
        } catch (err) {
            console.error("Failed to copy text: ", err);
        }
    };
    return (
        <li className="text-center p-6 rounded-xl list-none flex flex-row items-center gap-2">
            <span className="text-gray-600 dark:text-gray-400 flex justify-center">{icon}</span>
            <address className="flex-1 text-left not-italic">{action}</address>
            <div className="relative">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(action, index)}
                            className="h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-800"
                        >
                            <Copy className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Copy to clipboard</p>
                    </TooltipContent>
                </Tooltip>
                {copiedIndex === index && (
                    <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md whitespace-nowrap animate-in fade-in-0 zoom-in-95">
                        Copied to clipboard!
                    </div>
                )}
            </div>
        </li>
    );
}
