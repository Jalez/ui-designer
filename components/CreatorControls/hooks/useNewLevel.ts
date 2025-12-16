'use client';

import { useAppDispatch } from "@/store/hooks/hooks";
import { addNewLevel } from "@/store/slices/levels.slice";

export const useNewLevel = () => {
  const dispatch = useAppDispatch();

  const handleNewLevelCreation = () => {
    dispatch(addNewLevel());
  };

  return { handleNewLevelCreation };
};


