'use client';

//Add a button component that is used to save the current level and its changes to the backend server.

import { Button } from "@/components/ui/button";
import { useAppSelector } from "@/store/hooks/hooks";
import PoppingTitle from "../General/PoppingTitle";
import { Save } from "lucide-react";
import { levelUrl } from "@/constants";

const LevelSaver = () => {
  const currentLevel = useAppSelector(
    (state) => state.currentLevel.currentLevel
  );
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);

  const handleSave = () => {
    console.log("level", level);
    const name = level.name;
    fetch(levelUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ [name]: level }),
    })
      .then((response) => {
        if (
          response.ok &&
          response.headers.get("content-type")?.includes("application/json")
        ) {
          return response.json();
        }
        throw new Error("Response not JSON or not OK.");
      })
      .then((data) => console.log(data))
      .catch((error) => console.error("Error:", error));
  };
  return (
    <div className="flex flex-col justify-center items-center">
      <PoppingTitle topTitle="Save Level">
        <Button onClick={handleSave} variant="ghost" size="icon">
          <Save className="h-5 w-5" />
        </Button>
      </PoppingTitle>
    </div>
  );
};

export default LevelSaver;
