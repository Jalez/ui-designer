'use client';

import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { LevelIdAndName, MapDetails } from "@/types";
import { getLevelNames } from "@/lib/utils/network/levels";

type LevelAdderProps = {
  updateHandler: (map: MapDetails) => void;
  selectedMap: MapDetails;
};

const LevelAdder = ({ updateHandler, selectedMap }: LevelAdderProps) => {
  const [levelNames, setLevelNames] = useState<LevelIdAndName[]>([]);
  const [selectedLevelId, setSelectedLevelId] = useState("");

  useEffect(() => {
    // fetch maps from the server
    const fetchLevelNames = async () => {
      try {
        const levelNames = await getLevelNames();
        console.log("Level names:", levelNames[0]);
        setLevelNames(levelNames);
      } catch (error) {
        console.error("Error:", error);
      }
    };
    fetchLevelNames();
  }, []);

  const handleLevelIdSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    console.log("Selected level name:", event.target.value);
    setSelectedLevelId(event.target.value);
  };

  const addLevelIdToMap = async () => {
    selectedMap.levels.push(selectedLevelId);
    updateHandler(selectedMap);
  };

  const createLevelNameOptions = (levelIdAndNameArray: LevelIdAndName[]) => {
    const options = [];

    //use for ... of loop to iterate over the levelIdAndName array
    for (const level in levelIdAndNameArray) {
      const levelObj = levelIdAndNameArray[level];
      //Each level is an object where is a single key (identifier) and its value (name)
      // take the value of the key and add it to the options array
      const name = Object.values(levelObj)[0];
      options.push(
        <option
          key={Object.keys(levelObj)[0]}
          value={Object.keys(levelObj)[0]}
        >
          {name}
        </option>
      );
    }

    return options;
  };

  return (
    <div className="flex flex-col justify-center items-center space-y-4">
      <h2 id="edit-prompt-title" className="text-2xl font-semibold">
        Add a level:
      </h2>
      <p id="edit-prompt-description">
        Select a level to add to the map.
      </p>

      <div className="w-full space-y-2">
        <select
          value={selectedLevelId}
          onChange={handleLevelIdSelect}
          className="w-full p-2 border rounded"
        >
          {createLevelNameOptions(levelNames)}
        </select>
        <Button onClick={addLevelIdToMap} className="w-full">
          Add Level
        </Button>
      </div>
    </div>
  );
};

export default LevelAdder;
