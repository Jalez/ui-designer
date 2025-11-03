'use client';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";

type MapAdderProps = {
  updateMapNames: (name: string) => void;
};

const MapAdder = ({ updateMapNames }: MapAdderProps) => {
  const [newMap, setNewMap] = useState("");

  const addMap = async () => {
    if (!newMap.trim()) return; // prevent adding empty map names
    try {
      // await postMap(newMap);
      updateMapNames(newMap);
      setNewMap(""); // reset input after adding
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleNewMapInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMap(event.target.value);
  };
  return (
    <>
      <h2 id="add-map-title" className="text-2xl font-semibold mb-2">
        Add a new map:
      </h2>
      <p id="add-map-description" className="mb-4">
        You can add a new map to the UI designer. This map will be used to
        determine what levels are available to the user based on the value of
        the url search parameter "maps".
      </p>
      <form
        noValidate
        autoComplete="off"
        onSubmit={(event) => {
          event.preventDefault();
          addMap();
        }}
        className="flex flex-row items-center gap-2"
      >
        <Input
          placeholder="Enter new Map Name"
          value={newMap}
          onChange={(e) => setNewMap(e.target.value)}
          className="flex-1"
        />
        <Button onClick={addMap} type="submit">
          Add Map
        </Button>
      </form>
    </>
  );
};

export default MapAdder;
