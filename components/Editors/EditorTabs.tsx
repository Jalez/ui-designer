'use client';

import React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import CodeEditor from "./CodeEditor/CodeEditor";
import { Lock, LockOpen } from "lucide-react";
import { handleLocking } from "@/store/slices/levels.slice";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
function EditorTabs({
  EditorWidth,
  fileNames,
  fileContent,
  codeUpdater,
  identifier,
  locked,
  lang,
  title,
}: {
  title: "HTML" | "CSS" | "JS";
  EditorWidth?: number;
  lang: any;
  fileNames: string[];
  fileContent: {
    [key: string]: string;
  };
  codeUpdater: (
    data: { html?: string; css?: string; js?: string },
    type: string
  ) => void;
  identifier: string;
  locked: boolean;
}) {
  const currentLevel = useAppSelector(
    (state) => state.currentLevel.currentLevel
  );
  const options = useAppSelector((state) => state.options);
  const isCreator = options.creator;
  const dispatch = useAppDispatch();
  const [value, setValue] = React.useState(fileNames[0]);

  const handleChange = (newValue: string) => {
    setValue(newValue);
  };

  const handleLockUnlock = () => {
    dispatch(
      handleLocking({
        levelId: currentLevel,
        type: title.toLowerCase(),
      })
    );
  };

  //If template is empty, it is locked and we are not in the creator, dont show it
  if (!fileContent[value] && locked && !isCreator) {
    return <div></div>;
  }

  const createCodeEditorForFile = (code: string) => {
    return (
      <CodeEditor
        lang={lang}
        title={title}
        codeUpdater={codeUpdater}
        template={code}
        levelIdentifier={identifier}
        locked={locked}
        type={value}
      />
    );
  };
  return (
    <div
      className="flex flex-col justify-center items-center m-0 p-0 flex-1 min-h-[300px] h-full min-w-[200px] relative"
      style={{ width: EditorWidth ? `${EditorWidth}%` : undefined }}
    >
      <div className="flex flex-col justify-start items-start m-0 p-0 flex-1 h-full w-full relative ">
        <Tabs value={value} onValueChange={handleChange} className="w-full h-full flex flex-col">
          <div className="flex items-center gap-2">
            <TabsList>
              {fileNames.map((name, index) => (
                <TabsTrigger
                  key={index}
                  value={name}
                  className="text-primary"
                >
                  {name}
                </TabsTrigger>
              ))}
            </TabsList>
            {isCreator && (
              <Button
                size="icon"
                variant="ghost"
                onClick={handleLockUnlock}
                title={locked ? "Unlock" : "Lock"}
              >
                {locked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
              </Button>
            )}
          </div>
          {fileNames.map((name, index) => (
            <TabsContent key={index} value={name} className="flex-1 flex flex-col min-h-0">
              {createCodeEditorForFile(fileContent[name])}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}

export default EditorTabs;
