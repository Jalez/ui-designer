'use client';

import React from "react";

interface BoardProps {
  children: React.ReactNode;
}

export const Board = ({ children }: BoardProps) => {
  return (
    <div 
      className="board mt-[5px] mb-[5px] p-0 flex-shrink-0 h-fit w-fit box-border overflow-hidden border-[5px] border-[#111] flex flex-col justify-center items-center z-20 bg-secondary"
    >
      {children}
    </div>
  );
};
