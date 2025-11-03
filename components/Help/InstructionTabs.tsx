/** @format */
'use client';

import DynamicTabs from "../General/DynamicTabs/DynamicTabs";
import { tabsContent } from "./InstructionContent";

const InstructionTabs = () => {
  const tabsStyle: React.CSSProperties = {
    padding: 0,
    backgroundColor: "hsl(var(--primary))",
    color: "hsl(var(--primary-foreground))",
    overflow: "auto",
    boxShadow: "0px 2px 1px rgba(0, 0, 0, 0.25)",
  };
  return <DynamicTabs style={tabsStyle} tabs={tabsContent} />;
};

export default InstructionTabs;
