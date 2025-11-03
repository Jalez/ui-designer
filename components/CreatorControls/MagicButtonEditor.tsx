'use client';

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Pencil } from "lucide-react";

type MagicButtonEditorProps = {
  prompt: string;
  systemPrompt: string;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleSystemInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  fetchResponse: () => void;
  disabled?: boolean;
  color?: string;
};

const MagicButtonEditor = ({
  prompt,
  systemPrompt,
  handleInputChange,
  handleSystemInputChange,
  fetchResponse,
  disabled = false,
  color = "secondary",
}: MagicButtonEditorProps) => {
  const [open, setOpen] = useState(false);
  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  return (
    <>
      <Button
        variant={color === "secondary" ? "secondary" : "default"}
        size="icon"
        onClick={handleOpen}
        disabled={disabled}
      >
        <Pencil className="h-5 w-5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[80%] max-w-4xl bg-secondary border-2 border-black shadow-[0_0_24px] p-4">
          <DialogHeader>
            <DialogTitle id="edit-prompt-title" className="text-3xl">
              Prompts sent to ChatGPT
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <h3 id="edit-prompt-title" className="text-lg font-semibold mb-2">
                Edit System Prompt:
              </h3>
              <DialogDescription>
                This is the prompt that will tell the AI how to act, what to do, and
                what to generate. It should be a detailed description of the task
                you want the AI to perform.
              </DialogDescription>
              <textarea
                rows={3}
                className="w-full mt-2 p-2 border rounded"
                value={systemPrompt}
                onChange={handleSystemInputChange}
                aria-label="System prompt textarea"
              />
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-2">
                Edit Prompt:
              </h3>
              <DialogDescription>
                This is the prompt that should describe the level you want to
                create. It should be a detailed description of what code the student
                should write to complete the level, and what the final result should
                look like.
              </DialogDescription>
              <textarea
                rows={3}
                className="w-full mt-2 p-2 border rounded"
                value={prompt}
                onChange={handleInputChange}
                aria-label="Prompt textarea"
              />
            </div>
            
            <div className="flex gap-2">
              <Button onClick={fetchResponse}>Send to ChatGPT</Button>
              <Button onClick={handleClose} variant="outline">Close</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MagicButtonEditor;
