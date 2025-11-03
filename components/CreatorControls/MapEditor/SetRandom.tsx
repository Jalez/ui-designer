'use client';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapDetails } from "@/types";
import { useEffect, useState } from "react";

type SetRandomProps = {
  selectedMap: MapDetails;
  updateHandler: (map: MapDetails) => void;
};

const SetRandom = ({ selectedMap, updateHandler }: SetRandomProps) => {
  const [currentRandom, setCurrentRandom] = useState(selectedMap.random);

  useEffect(() => {
    setCurrentRandom(selectedMap.random);
  }, [selectedMap.random]);

  const handlePartialUpdate = (event: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentRandom(parseInt(event.target.value));
  };

  const handleUpdate = () => {
    selectedMap.random = currentRandom;
    updateHandler(selectedMap);
  };

  return (
    <div className="w-[400px]">
      <div className="flex flex-row items-center justify-center gap-2 mb-2">
        <h2 id="edit-random" className="text-2xl font-semibold">
          Random:
        </h2>
        <Input
          id="random"
          type="number"
          value={currentRandom}
          onChange={handlePartialUpdate}
          className="w-20"
        />
        <Button onClick={handleUpdate}>
          Update
        </Button>
      </div>
      <p id="edit-prompt-title">
        This determines how many levels are randomly selected from the list of
        levels. If set to 0, all levels will be used.
      </p>
    </div>
  );
};

export default SetRandom;
