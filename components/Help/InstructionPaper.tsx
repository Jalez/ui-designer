'use client';

import React from "react";
import { Card } from "@/components/ui/card";

interface InstructionPaperProps {
  children: React.ReactNode;
}

const InstructionPaper = ({ children }: InstructionPaperProps) => {
  return (
    <Card 
      role="region" 
      aria-label="Instruction"
    >
      {children}
    </Card>
  );
};

export default InstructionPaper;
