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
  const dispatch = useAppDispatch();
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const levels = useAppSelector((state: any) => state.levels);

  const level = levels[currentLevel - 1] as Level;
  
  // Early return if level doesn't exist - parent handles loading state
  if (!level) {
    return null;
  }
  
  const identifier = level.identifier;

  const codeUpdater = (
    language: 'html' | 'css' | 'js',
    code: string,
    isSolution: boolean
  ) => {
    if (!levels[currentLevel - 1]) return;
    
    if (isSolution) {
      dispatch(
        updateSolutionCode({
          id: currentLevel,
          code: { ...levels[currentLevel - 1].solution, [language]: code },
        })
      );
    } else {
      dispatch(
        updateCode({
          id: currentLevel,
          code: { ...levels[currentLevel - 1].code, [language]: code },
        })
      );
    }
  };

  const languages = {
    html: {
      code: level.code.html || '',
      solution: level.solution.html || '',
      locked: level.lockHTML,
    },
    css: {
      code: level.code.css || '',
      solution: level.solution.css || '',
      locked: level.lockCSS,
    },
    js: {
      code: level.code.js || '',
      solution: level.solution.js || '',
      locked: level.lockJS,
    },
  };

  return (
    <div className="flex-1 flex flex-row justify-center items-stretch">
      <EditorTabs
        languages={languages}
        codeUpdater={codeUpdater}
        identifier={identifier}
      />
    </div>
  );
};

export default Editors;
