/** @format */
'use client';

import * as React from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home } from "lucide-react";
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
    <div className="min-h-screen bg-background">
      {/* Header with navigation */}
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBackToGame}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Game
              </Button>
              <div className="text-sm text-muted-foreground">
                Help & Instructions
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBackToGame}
              className="flex items-center gap-2"
            >
              <Home className="h-4 w-4" />
              Home
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 p-4">
        <div className="max-w-4xl mx-auto">
          {/* Page title */}
          <div className="text-center mb-8">
            <Title />
            <p className="text-lg text-muted-foreground mt-4 max-w-2xl mx-auto">
              Learn how to use the UI Designer tool effectively. Follow these instructions to create beautiful web components and maximize your scores.
            </p>
          </div>

          {/* Help content */}
          <InstructionPaper className="mb-8">
            <InstructionContentContainer>
              <InstructionTabs />
            </InstructionContentContainer>
          </InstructionPaper>

          {/* Call to action */}
          <div className="text-center">
            <div className="bg-card border rounded-lg p-6 max-w-md mx-auto">
              <h3 className="text-lg font-semibold mb-2">Ready to start designing?</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Put your HTML, CSS, and JavaScript skills to the test!
              </p>
              <Button onClick={handleBackToGame} size="lg" className="w-full">
                Start Designing
              </Button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-card mt-12">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="text-center text-sm text-muted-foreground">
            <p>Need more help? Check out the individual tabs above for detailed instructions.</p>
            <p className="mt-2">
              Inspired by{" "}
              <a
                href="https://cssbattle.dev/"
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                CSS Battle
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
