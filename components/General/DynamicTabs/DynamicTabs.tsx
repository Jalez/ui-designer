/** @format */
'use client';

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
      {children}
    </TabsContent>
  );
}

interface TabProps {
  style?: React.CSSProperties;
  tabs: {
    label: string;
    // Make content expect a React.ReactNode
    content: React.ReactNode;
  }[];
}

function allyProps(index: number) {
  return {
    id: `simple-tab-${index}`,
    "aria-controls": `simple-tabpanel-${index}`,
  };
}

export default function DynamicTabs({ style, tabs }: TabProps) {
  const [value, setValue] = React.useState("tab-0");

  return (
    <Tabs value={value} onValueChange={setValue} className="w-full">
      <div className="border-b" style={{ borderColor: "hsl(var(--border))" }}>
        <TabsList className="w-full justify-start">
          {tabs.map((tab, index) => (
            <TabsTrigger 
              value={`tab-${index}`} 
              key={index}
              className="text-primary"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {tabs.map((tab, index) => (
        <div 
          key={index}
          style={style}
          className="p-0 overflow-auto"
        >
          <TabPanel value={value} index={index}>
            <div className="p-[3px]">{tab.content}</div>
          </TabPanel>
        </div>
      ))}
    </Tabs>
  );
}
