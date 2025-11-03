'use client';

import LevelSaver from "./LevelSaver";
import NewLevel from "./NewLevel";
import LevelRemover from "./LevelRemover";
import { useAppSelector } from "@/store/hooks/hooks";
import MagicButton from "./UniversalMagicButton";
import MapEditor from "./MapEditor";

const CreatorControls = () => {
  const options = useAppSelector((state) => state.options);
  const isCreator = options.creator;
  if (!isCreator) return null;
  return (
    <>
      <LevelRemover />
      <LevelSaver />
      <NewLevel />
      <MagicButton />
      <MapEditor />
    </>
  );
};

export default CreatorControls;
