/** @format */
'use client';

import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import {
  updateCode,
  updateSolutionCode,
} from "@/store/slices/levels.slice";
import { Level } from "@/types";
import { javascript } from "@codemirror/lang-javascript";
import EditorTabs from "./EditorTabs";

const Editors = (): React.ReactNode => {
  const options = useAppSelector((state) => state.options);
  const isCreator = options.creator;
  const dispatch = useAppDispatch();
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const levels = useAppSelector((state: any) => state.levels);

  const level = levels[currentLevel - 1] as Level;
  const identifier = level?.identifier;

  const codeUpdater = (
    data: { html?: string; css?: string; js?: string },
    type: string
  ) => {
    if (!levels[currentLevel - 1]) return;
    if (type === "html" || type === "css" || type === "javascript") {
      dispatch(
        updateCode({
          id: currentLevel,
          code: { ...levels[currentLevel - 1].code, ...data },
        })
      );
    } else {
      dispatch(
        updateSolutionCode({
          id: currentLevel,
          code: { ...levels[currentLevel - 1].solution, ...data },
        })
      );
    }
  };

  function getCodeObject(language: "css" | "html" | "js", isCreator: boolean) {
    const levelCode = levels[currentLevel - 1].code[language];
    const levelSolution = levels[currentLevel - 1].solution[language];

    const languageName = language === "js" ? "javascript" : language;

    return isCreator
      ? { Solution: levelSolution, [languageName]: levelCode }
      : { [languageName]: levelCode };
  }

  const Css = getCodeObject("css", isCreator);
  const Html = getCodeObject("html", isCreator);
  const Js = getCodeObject("js", isCreator);

  return (
    <div className="flex-1 flex flex-row justify-center">
      <EditorTabs
        title="HTML"
        codeUpdater={codeUpdater}
        identifier={identifier}
        lang={html()}
        fileNames={Object.keys(Html)}
        fileContent={Html as any}
        locked={level.lockHTML}
      />

      <EditorTabs
        title="CSS"
        codeUpdater={codeUpdater}
        identifier={identifier}
        lang={css()}
        fileNames={Object.keys(Css)}
        fileContent={Css as any}
        locked={level.lockCSS}
      />

      <EditorTabs
        title="JS"
        codeUpdater={codeUpdater}
        identifier={identifier}
        lang={javascript()}
        fileNames={Object.keys(Js)}
        fileContent={Js as any}
        locked={level.lockJS}
      />
    </div>
  );
};

export default Editors;
