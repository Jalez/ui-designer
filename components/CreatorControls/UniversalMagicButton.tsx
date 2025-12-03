'use client';

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { Level } from "@/types";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { addThisLevel } from "@/store/slices/levels.slice";
import MagicButtonEditor from "./MagicButtonEditor";
import PoppingTitle from "../General/PoppingTitle";
import { chatGPTURl } from "@/constants";

const MagicButton = () => {
  const dispatch = useAppDispatch();
  const currentlevel = useAppSelector(
    (state) => state.currentLevel.currentLevel
  );
  const level = useAppSelector((state) => state.levels[currentlevel - 1]);
  const name = level.name;
  const [open, setOpen] = useState(false);
  const [openEditor, setOpenEditor] = useState(false);
  const [loading, setLoading] = useState(false);
  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);
  const [newLevel, setNewLevel] = useState<string>("");
  const [systemPrompt, setSystemPrompt] =
    useState(`You are an AI trained to assist in creating web development educational content. Please generate a detailed web development lesson for a given component. The lesson should be structured in JSON format with the following keys:

- "name": The title of the lesson, indicative of the web component to be developed.
- "code": Contains the template html/js/css for the students. The HTML should be simple and include placeholder elements where students will add what elements are needed to accomplish the creation of desired element. The CSS should include all units and colors, offering them through CSS variables in :root for easy access to student. 
- "solution": Provide the fully developed HTML, CSS, and JavaScript that represent the final and correct implementation of the component. Ensure the HTML uses semantic tags, the CSS employs advanced styling techniques such as flexbox or grid, and the JavaScript effectively enhances the component's functionality.

The response should be directly in JSON format suitable for immediate integration into the web development teaching platform. Always return it in the format as shown in the following example: 

{
  "name": "${name}",
  "code": {
    "html": "<!-- Template HTML for students goes here -->",
    "css": "/* Template CSS for students goes here */",
    "js": "// Starting code for the students DOM manipulation goes here "
  },
  "solution": {
    "html": "<!-- Here is the complete HTML -->",
    "css": "/* Here are the complete styles, including layout and responsiveness */",
    "js": "// Here's all the JavaScript for interactivity and functionality that was needed to complete the component" 
     */"
  }
}`);
  const [prompt, setPrompt] = useState(
    `Create a level for a component named ${name}. `
  );

  const fetchResponse = async () => {
    //Use our API to get a response from AI, use the name of the level in the prompt
    try {
      handleClose();
      setLoading(true);
      const response = await fetch(chatGPTURl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ systemPrompt, prompt }),
      });
      const data = await response.json();
      if (typeof data === "string") {
        setNewLevel(data);
      } else {
        setNewLevel(JSON.stringify(data));
      }
      //open the modal
      setLoading(false);
      handleOpen();
    } catch (error) {
      setLoading(false);
      console.error("Error:", error);
    }
  };

  const handleApprove = () => {
    dispatch(addThisLevel(newLevel));
  };

  const formatNewLevel = (newLevel: any) => {
    //Format it so that it can be shown in the modal
    return JSON.stringify(newLevel, null, 2);
  };

  const handleSystemInputChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setSystemPrompt(event.target.value);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(event.target.value);
  };

  const handleLevelEdit = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewLevel(event.target.value);
  };
  return (
    <>
      {loading && (
        <div className="flex items-center justify-center p-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}
      {!loading && (
        <>
          <PoppingTitle topTitle="Generate a level">
            <Button variant="ghost" size="icon" onClick={fetchResponse}>
              <Sparkles className="h-5 w-5" />
            </Button>
          </PoppingTitle>
          <PoppingTitle topTitle="Edit generator prompt">
            <MagicButtonEditor
              color="primary"
              prompt={prompt}
              systemPrompt={systemPrompt}
              handleInputChange={handleInputChange}
              handleSystemInputChange={handleSystemInputChange}
              fetchResponse={fetchResponse}
            />
          </PoppingTitle>
        </>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[80%] max-w-4xl bg-secondary border-2 border-black shadow-[0_0_24px] p-4 text-primary">
          <DialogHeader>
            <DialogTitle id="modal-modal-title">
              Response from ChatGPT:
            </DialogTitle>
          </DialogHeader>
          <textarea
            rows={10}
            className="w-full mt-2 p-2 border rounded bg-background text-foreground"
            value={newLevel}
            onChange={handleLevelEdit}
            aria-label="AI response textarea"
          />
          <div className="flex gap-2 mt-4">
            <Button
              onClick={() => {
                handleApprove();
                handleClose();
              }}
            >
              Approve
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                console.log("Rejecting");
                handleClose();
              }}
            >
              Reject
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MagicButton;
