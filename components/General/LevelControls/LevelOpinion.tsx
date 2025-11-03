'use client';

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useAppSelector } from "@/store/hooks/hooks";
import PoppingTitle from "../PoppingTitle";

const LevelOpinion = () => {
  const [opinion, setOpinion] = useState("");
  const options = useAppSelector((state) => state.options);
  const isCreator = options.creator;

  const handleOpinionChange = (newOpinion: string) => {
    setOpinion(opinion === newOpinion ? "" : newOpinion); // Toggle opinion on click
  };
  if (isCreator) {
    return null;
  }

  return (
    <div className="absolute z-[200]">
      <PoppingTitle bottomTitle="Opinion on level">
        <div className="flex flex-row justify-center items-center">
          <Button
            size="icon"
            variant="ghost"
            title="like"
            onClick={() => handleOpinionChange("up")}
            className="active:scale-125 transition-transform duration-200"
          >
            <ThumbsUp
              className={`h-5 w-5 ${opinion === "up" ? "text-green-500" : "text-black"}`}
            />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            title="dislike"
            onClick={() => handleOpinionChange("down")}
            className="active:scale-125 transition-transform duration-200"
          >
            <ThumbsDown
              className={`h-5 w-5 ${opinion === "down" ? "text-red-500" : "text-black"}`}
            />
          </Button>
        </div>
      </PoppingTitle>
    </div>
  );
};

export default LevelOpinion;
