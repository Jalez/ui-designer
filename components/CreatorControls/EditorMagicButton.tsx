'use client';

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Level } from "@/types";
import { useAppSelector } from "@/store/hooks/hooks";
import MagicButtonEditor from "./MagicButtonEditor";
import { chatGPTURl } from "@/constants";

type EditorMagicButtonProps = {
  answerKey?: string;
  EditorCode: string;
  editorCodeChanger: (newCode: string) => void;
  editorType: string;
  disabled?: boolean;
  newPrompt?: string;
  newSystemPrompt?: string;
  exampleResponse?: string;
  buttonColor?: string;
};

// function formatHtmlString(escapedHtml: string) {
//   // Unescape HTML-specific characters and remove unnecessary backslashes
//   let formattedHtml = escapedHtml
//     .replace(/\\n/g, "\n") // Replace escaped newlines with actual newlines
//     .replace(/\\\"/g, '"') // Replace escaped double quotes with actual double quotes
//     .replace(/\\\\/g, "\\"); // Replace double backslashes with a single backslash

//   return formattedHtml;
// }

const EditorMagicButton = ({
  answerKey = "code",
  buttonColor = "secondary",
  EditorCode,
  editorCodeChanger,
  editorType,
  disabled = false,
  newPrompt,
  newSystemPrompt,
  exampleResponse = "{" + '"code": "/**New and improved code here*/"' + "}",
}: EditorMagicButtonProps) => {
  const currentlevel = useAppSelector(
    (state) => state.currentLevel.currentLevel
  );
  const level = useAppSelector((state) => state.levels[currentlevel - 1]);
  const name = level.name;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);
  const [codeChanges, setCodeChanges] = useState<string>("");
  const defaultSystemPromptAddOn = `Return a json with "${answerKey}"-key that contains the new and improved code for the component.`;
  const [systemPrompt, setSystemPrompt] = useState(
    newSystemPrompt ||
      `You are an AI trained to assist in creating web development educational content. Please generate code for a given component in ${editorType}. 
`
  );
  const [prompt, setPrompt] = useState(
    newPrompt ||
      `Improve the following ${editorType} for a component named ${name}:
Improvements based on the following code: 
- IF CSS: make it more responsive, move magic numbers to named variables in root. 
- If HTML: add accessibility attributes, make it more semantic.
- IF JS: make it more efficient, use more modern syntax.

`
  );

  useEffect(() => {
    setPrompt(
      newPrompt ||
        `Improve the following ${editorType} for a component named ${name}:
Improvements based on the following code: 
- IF CSS: make it more responsive, move magic numbers to named variables in root. 
- If HTML: add accessibility attributes, make it more semantic.
- IF JS: make it more efficient, use more modern syntax.

`
    );
  }, [EditorCode, newPrompt]);

  useEffect(() => {
    setSystemPrompt(
      newSystemPrompt ||
        `You are an AI trained to assist in creating web development educational content. Please generate code for a given component in ${editorType}.`
    );
  }, [editorType, newSystemPrompt]);

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
        body: JSON.stringify({
          systemPrompt:
            systemPrompt +
            defaultSystemPromptAddOn +
            "example response:" +
            "'''" +
            `{
              "${answerKey}": "${exampleResponse}"
            }` +
            "'''",
          prompt: prompt + "code to improve:" + "'''" + EditorCode + "'''",
        }),
      });
      const data = await response.json();

      if (typeof data === "string") {
        const dP = JSON.parse(data);
        if (typeof dP[answerKey] === "string") {
          setCodeChanges(
            dP[answerKey] || `No ${answerKey}-key in response: ${dP}`
          );
        } else {
          // stringifying the object
          setCodeChanges(
            JSON.stringify(dP[answerKey]) ||
              `No ${answerKey}-key in response: ${dP}`
          );
        }
      }

      setLoading(false);
      handleOpen();
    } catch (error) {
      setLoading(false);
      console.error("Error:", error);
    }
  };

  const handleApprove = () => {
    editorCodeChanger(codeChanges);
  };

  const handleSystemInputChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setSystemPrompt(event.target.value);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(event.target.value);
  };

  const handleCodeChanges = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCodeChanges(event.target.value);
  };
  return (
    <>
      {loading && (
        <div className="flex items-center justify-center p-2">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </div>
      )}
      {!loading && (
        <>
          <Button
            variant="ghost"
            size="icon"
            onClick={fetchResponse}
            disabled={disabled}
          >
            <Sparkles className="h-5 w-5" />
          </Button>
          <MagicButtonEditor
            color={buttonColor}
            disabled={disabled}
            prompt={prompt}
            systemPrompt={systemPrompt}
            handleInputChange={handleInputChange}
            handleSystemInputChange={handleSystemInputChange}
            fetchResponse={fetchResponse}
          />
        </>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-fit max-w-[90vw] bg-secondary border-2 border-black shadow-[0_0_24px] p-4 text-primary">
          <DialogHeader>
            <DialogTitle id="modal-modal-title">
              Response from ChatGPT (Can be edited):
            </DialogTitle>
          </DialogHeader>
          <textarea
            rows={10}
            className="w-[90vw] max-w-full overflow-auto mt-2 p-2 border rounded bg-background text-foreground"
            value={codeChanges}
            onChange={handleCodeChanges}
            aria-label="Code changes textarea"
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

export default EditorMagicButton;
