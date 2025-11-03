'use client';

import React from "react";
import { secondaryColor } from "@/constants";

interface BoardTitleProps {
  children: React.ReactNode;
  side?: "left" | "right";
}

export const BoardTitle = ({ children, side = "left" }: BoardTitleProps) => {
  return (
    <div
      className="[writing-mode:vertical-rl] text-[2rem] flex justify-center z-[2] h-fit m-0 box-border border-[5px] border-[#111] relative flex-shrink-0 text-primary"
      style={{
        backgroundColor: secondaryColor,
        right: side === "left" ? "-5px" : "5px",
      }}
    >
      <h3 className="text-2xl font-semibold text-primary">
        {children}
      </h3>
    </div>
  );
};
