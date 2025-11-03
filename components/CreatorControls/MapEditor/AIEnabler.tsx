'use client';

import { Button } from "@/components/ui/button";
import { MapDetails } from "@/types";

type AIEnablerProps = {
  updateHandler: (map: MapDetails) => void;
  selectedMap: MapDetails;
};

const AIEnabler = ({ updateHandler, selectedMap }: AIEnablerProps) => {
  const handleUpdate = () => {
    selectedMap.canUseAI = !selectedMap.canUseAI;
    updateHandler(selectedMap);
  };

  return (
    <div className="flex flex-row items-center justify-center gap-2">
      <h2 id="edit-ai-title" className="text-2xl font-semibold">
        AI Enabled: {selectedMap.canUseAI ? "Yes" : "No"}
      </h2>
      <Button onClick={handleUpdate}>
        Toggle AI
      </Button>
    </div>
  );
};
export default AIEnabler;
