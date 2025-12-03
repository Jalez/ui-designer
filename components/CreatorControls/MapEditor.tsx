'use client';

import { Map } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import PoppingTitle from "../General/PoppingTitle";
import { useEffect, useState } from "react";
import { Level, MapDetails } from "@/types";
import AIEnabler from "./MapEditor/AIEnabler";
import LevelAdder from "./MapEditor/LevelAdder";
import MapLevels from "./MapEditor/MapLevels";
import MapSelector from "./MapEditor/MapSelector";
import MapAdder from "./MapEditor/MapAdder";
import {
  getMapLevels,
  getMapNames,
  updateMap,
} from "@/lib/utils/network/maps";
import SetRandom from "./MapEditor/SetRandom";

const MapEditor = () => {
  const [open, setOpen] = useState(false);
  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);
  const [selectedMapName, setSelectedMapName] = useState("");
  const [MapNames, setMapNames] = useState<string[]>([]);
  const [selectedMapDetails, setSelectedMapDetails] = useState<MapDetails>({
    levels: [],
    canUseAI: false,
    random: 0,
  });
  const [mapLevels, setMapLevels] = useState<Level[]>([]);
  useEffect(() => {
    // fetch maps from the server
    const fetchMapNames = async () => {
      setMapNames(await getMapNames());
    };
    fetchMapNames();
  }, []);

  useEffect(() => {
    const fetchMapLevels = async () => {
      if (selectedMapName) {
        const levels = await getMapLevels(selectedMapName);
        console.log("levels", levels);
        // JATKETAAN TÄSTÄ, EN NYT JAKSA- T: PERJANTAI JAKKE
        setMapLevels(levels);
        // setSelectedMapDetails(await getMapLevels(selectedMap));
      }
    };
    fetchMapLevels();
  }, [selectedMapName]);

  const updateSelectedMapDetails = async (newDetails: MapDetails) => {
    try {
      const updatedMap = await updateMap(selectedMapName, newDetails);
      console.log("Updated map:", updatedMap);
      setSelectedMapDetails(updatedMap);
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleMapNameSelect = (newMapName: string) => {
    setSelectedMapName(newMapName);
  };

  const handleMapDetailsSelect = (newMapDetails: MapDetails) => {
    setSelectedMapDetails(newMapDetails);
  };

  const updateMapNames = (newName: string) => {
    setMapNames([...MapNames, newName]);
  };

  return (
    <>
      <PoppingTitle topTitle="Maps">
        <Button variant="ghost" size="icon" onClick={handleOpen}>
          <Map className="h-5 w-5" />
        </Button>
      </PoppingTitle>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[80%] max-w-6xl border-2 border-black shadow-[0_0_24px] p-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle id="edit-prompt-title" className="text-3xl">
              Game Maps
            </DialogTitle>
          </DialogHeader>
          
          <MapAdder updateMapNames={updateMapNames} />

          {MapNames.length !== 0 && (
            <MapSelector
              MapNames={MapNames}
              handleNameSelect={handleMapNameSelect}
              updateDetails={handleMapDetailsSelect}
              selectedMap={selectedMapName}
            />
          )}
          {selectedMapName && (
            <Card className="flex flex-col gap-4 m-4 p-4 border border-secondary rounded-2xl bg-primary/80">
              <h2 id="edit-prompt-title" className="text-2xl font-semibold">
                Selected Map: {selectedMapName}
              </h2>
              <div className="flex flex-row items-start justify-around gap-4">
                <LevelAdder
                  updateHandler={updateSelectedMapDetails}
                  selectedMap={selectedMapDetails}
                />
                <MapLevels
                  selectedMapDetails={selectedMapDetails}
                  levels={mapLevels}
                />

                <div className="flex flex-col gap-4">
                  <AIEnabler
                    updateHandler={updateSelectedMapDetails}
                    selectedMap={selectedMapDetails}
                  />
                  <SetRandom
                    selectedMap={selectedMapDetails}
                    updateHandler={updateSelectedMapDetails}
                  />
                </div>
              </div>
            </Card>
          )}
          <Button variant="destructive" onClick={handleClose}>
            Close
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MapEditor;
