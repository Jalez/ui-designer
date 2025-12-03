'use client';

import { useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Code2, Play } from "lucide-react";
import { useAppSelector } from "@/store/hooks/hooks";
import PoppingTitle from "@/components/General/PoppingTitle";

export const ModeToggleButton = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const options = useAppSelector((state) => state.options);
  const isCreator = options.creator;

  const toggleMode = useCallback(() => {
    const newMode = isCreator ? "game" : "creator";
    
    // Create new URLSearchParams with all existing params
    const params = new URLSearchParams(searchParams.toString());
    
    // Update or set the mode parameter
    params.set("mode", newMode);
    
    // Navigate with updated params
    router.push(`${pathname}?${params.toString()}`);
  }, [isCreator, pathname, searchParams, router]);

  return (
    <PoppingTitle topTitle={isCreator ? "Switch to Test Mode" : "Switch to Creator Mode"}>
      <Button
        size="icon"
        variant="ghost"
        title={isCreator ? "Test Mode" : "Creator Mode"}
        onClick={toggleMode}
      >
        {isCreator ? <Play className="h-5 w-5" /> : <Code2 className="h-5 w-5" />}
      </Button>
    </PoppingTitle>
  );
};

