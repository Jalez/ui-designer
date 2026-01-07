"use client";

import { CheckIcon } from "lucide-react";
import { Button } from "@/components/tailwind/ui/button";
import { cn } from "@/lib/utils";

interface DimensionOptionButtonProps {
    value: string;
    label: string;
    isSelected: boolean;
    onClick: () => void;
}

export function DimensionOptionButton({ value, label, isSelected, onClick }: DimensionOptionButtonProps) {
    console.log(value, label, isSelected);
    return (
        <Button
            type="button"
            size="sm"
            onClick={onClick}
            aria-pressed={isSelected}
        >
            {isSelected ? <><CheckIcon className="w-4 h-4" /> <span >{label}</span></> : label}
        </Button>
    );
}
