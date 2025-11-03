/** @format */
'use client';

import * as React from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

import { Title } from "../../components/Title/Title";
import InstructionTabs from "../../components/Help/InstructionTabs";
import InstructionPaper from "../../components/Help/InstructionPaper";
import InstructionContentContainer from "../../components/Help/InstructionContentContainer";

export default function HelpPage() {
  const router = useRouter();

  const handleBackToGame = React.useCallback(() => {
    router.push("/");
  }, [router]);

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto">
        <InstructionPaper>
          <Title />
          <InstructionContentContainer>
            <InstructionTabs />
            <div className="flex justify-center mt-6">
              <Button onClick={handleBackToGame}>
                <strong>Back to Game</strong>
              </Button>
            </div>
          </InstructionContentContainer>
        </InstructionPaper>
      </div>
    </div>
  );
}
