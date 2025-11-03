'use client';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { useState } from "react";
import { Check } from "lucide-react";

interface InputProps {
  actionToDispatch: any;
  reduxState: string;
  dataType?: string;
  finishEditHandler?: () => void;
}

const InfoInput = ({
  reduxState,
  actionToDispatch,
  dataType,
  finishEditHandler,
}: InputProps) => {
  const currentLevel = useAppSelector(
    (state) => state.currentLevel.currentLevel
  );
  const detail = useAppSelector(
    (state: any) => state.levels[currentLevel - 1][reduxState]
  );
  const [value, setValue] = useState(detail);

  const dispatch = useAppDispatch();
  const handleChange = (e: any) => {
    setValue(e.target.value);
  };

  const handleUpdate = () => {
    dispatch(actionToDispatch({ levelId: currentLevel, text: value }));
    finishEditHandler && finishEditHandler();
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleUpdate();
      }}
      className="w-full flex flex-row justify-center items-center m-0 p-0"
    >
      <Input
        className="text-primary w-10"
        type={dataType}
        value={value}
        onChange={handleChange}
      />
      <Button type="submit" size="icon" variant="ghost" onClick={handleUpdate}>
        <Check className="h-4 w-4" />
      </Button>
    </form>
  );
};

export default InfoInput;
