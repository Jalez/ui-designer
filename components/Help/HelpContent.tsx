'use client';

import React, { useState } from "react";
import { useSelector } from "react-redux";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils/cn";

type StyledBoxProps = {
  width: number;
};

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: string;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  const tabValue = `tab-${index}`;

  if (value !== tabValue) return null;

  return (
    <TabsContent value={tabValue} {...other} className="mt-0">
      <div className="p-3">{children}</div>
    </TabsContent>
  );
}

type HelpContentProps = {
  height: number;
};

export const HelpContent = ({ height }: HelpContentProps): React.ReactNode => {
  const [value, setValue] = useState("tab-0");
  const { currentLevel } = useSelector((state: any) => state.currentLevel);
  const levelDetails = useSelector(
    (state: any) => state.levels[currentLevel - 1]
  );
  const { description } = levelDetails.help;

  const titlesAndDescriptions = [
    {
      title: "General",
      description: "As a CSS artist...",
      // Add the rest of the description
    },
    {
      title: "This level",
      description: description,
    },
  ];

  return (
    <div
      className={cn(
        "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
        "bg-primary border-2 border-black text-secondary shadow-[0_0_24px] p-1 box-border"
      )}
      style={{ width: `${height}px` }}
      id="help-modal"
      aria-labelledby="help-modal-title"
      aria-describedby="help-modal-description"
    >
      <Tabs value={value} onValueChange={setValue} className="w-full">
        <div className="border-b" style={{ borderColor: "hsl(var(--border))" }}>
          <TabsList className="w-full justify-start">
            {titlesAndDescriptions.map((titleAndDescription, index) => (
              <TabsTrigger
                value={`tab-${index}`}
                key={index}
              >
                {titleAndDescription.title}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {titlesAndDescriptions.map((titleAndDescription, index) => (
          <TabPanel value={value} index={index} key={index}>
            <h3 id="help-modal-title" className="text-xl font-semibold">
              {titleAndDescription.title}
            </h3>
            <p id="help-modal-description" className="mt-2">
              {titleAndDescription.description}
            </p>
          </TabPanel>
        ))}
      </Tabs>
    </div>
  );
};
