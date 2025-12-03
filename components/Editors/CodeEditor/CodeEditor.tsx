/** @format */
'use client';

import { html } from "@codemirror/lang-html";
import CodeMirror from "@uiw/react-codemirror";
import { EditorView } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { useEffect, useState } from "react";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";
import { Compartment } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { githubLight } from "@uiw/codemirror-theme-github";
import { ReactCodeMirrorProps } from "@uiw/react-codemirror";
import { useAppSelector } from "@/store/hooks/hooks";
import { getCommentKeymap } from "./getCommentKeyMap";
import EditorMagicButton from "@/components/CreatorControls/EditorMagicButton";
import { useTheme } from "next-themes";
interface CodeEditorProps {
  lang: any;
  title: "HTML" | "CSS" | "JS";
  template?: string;
  codeUpdater: (data: { html?: string; css?: string }, type: string) => void;
  locked?: boolean;
  type: string;
  levelIdentifier: string;
}

const commentKeymapCompartment = new Compartment();

interface CodeMirrorProps extends ReactCodeMirrorProps {
  options: {
    lineWrapping?: boolean;
    lineNumbers?: boolean;
    viewportMargin?: number;
    readOnly?: boolean;
    className?: string;
    screenReaderLabel?: string;
    autofocus?: boolean;
    highlightActiveLine?: boolean;
    // add any other CodeMirror options you need here
  };
}

const CodeEditorStyle = {
  overflow: "auto",
  boxSizing: "border-box" as const,
  margin: "0",
  padding: "0",
  minHeight: "20px",
};

export default function CodeEditor({
  lang = html(),
  title = "HTML",
  template = "",
  codeUpdater,
  locked = false,
  type = "Template",
  levelIdentifier,
}: CodeEditorProps) {
  const lineNumberCompartment = new Compartment();
  const [code, setCode] = useState<string>(template);
  const options = useAppSelector((state) => state.options);
  const { theme: nextTheme } = useTheme();
  const isDark = nextTheme === 'dark' || (nextTheme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const theme = isDark ? vscodeDark : githubLight;
  
  // Custom theme extension to ensure consistent line backgrounds and font size
  // Override all possible background styles from base themes
  const consistentLineTheme = EditorView.theme({
    "&": {
      backgroundColor: "transparent !important",
      fontSize: "14px",
      fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
    },
    ".cm-scroller": {
      backgroundColor: "transparent !important",
    },
    ".cm-content": {
      backgroundColor: "transparent !important",
      fontSize: "14px",
      fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
    },
    ".cm-line": {
      fontSize: "14px",
      fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
    },

    ".cm-gutters": {
      backgroundColor: "transparent !important",
      fontSize: "14px",
      fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
    },
    ".cm-gutter": {
      backgroundColor: "transparent !important",
    },
  }, { dark: isDark });
  const handleCodeUpdate = (value: string) => {
    if (!locked) {
      setCode(value);
      // setSavedChanges(false);
    }
  };

  const isCreator = options.creator;
  // const [savedChanges, setSavedChanges] = useState<boolean>(true);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    // if (code !== "" && savedChanges) {
    if (code !== "") {
      // console.log("updating code: ", title.toLowerCase());
      timer = setTimeout(() => {
        codeUpdater({ [title.toLowerCase()]: code }, type);
      }, 200);
    }
    // listen for keydown events to set unsaved changes to true: ctrl + s

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [code]);
  // }, [code, savedChanges]);

  // useEffect(() => {
  //   const handleKeyDown = (e: KeyboardEvent) => {
  //     if (e.ctrlKey && e.key === "s") {
  //       // can I prevent the default behavior of the browser here?
  //       e.preventDefault();
  //       // setSavedChanges(true);
  //     }
  //   };
  //   document.addEventListener("keydown", handleKeyDown);
  //   return () => {
  //     document.removeEventListener("keydown", handleKeyDown);
  //   };
  // }, [savedChanges]);

  useEffect(() => {
    setCode(template);
  }, [template, levelIdentifier]);

  const cmProps: CodeMirrorProps = {
    options: {
      lineWrapping: true,
      lineNumbers: true,
      // readOnly: true,
      className: "readOnly",
      screenReaderLabel: "Code Editor for " + title,
      autofocus: locked ? false : true,
      // make background black
    },
    // value: code,
    extensions: [
      lang,
      EditorState.readOnly.of(locked),
      EditorView.editable.of(!locked),
      EditorView.lineWrapping,
      consistentLineTheme,
      // keymap.of(commentKeymap),
      commentKeymapCompartment.of(keymap.of(getCommentKeymap(title))), // default language
    ],
    theme: theme,
    placeholder: `Write your ${title} here...`,

    onChange: handleCodeUpdate,
  };

  const cmPropsFirstLine: CodeMirrorProps = {
    options: {
      lineWrapping: true,
      lineNumbers: false,
      readOnly: true,
      className: "readOnly",
      screenReaderLabel: "Code Editor for " + title,
      autofocus: locked ? false : true,
      highlightActiveLine: false,
    },
    // value: code,
    extensions: [
      // lang,
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
      EditorView.lineWrapping,
      consistentLineTheme,
      lineNumberCompartment.of([]),
    ],
    theme: theme,
    placeholder: `Write your ${title} here...`,
  };

      return (
        <div
          className="codeEditorContainer flex flex-1 flex-col w-full h-full relative min-h-0"
        >
      {isCreator && (
        <div className="absolute bottom-0 right-0 z-[100]">
          <EditorMagicButton
            buttonColor="primary"
            EditorCode={code}
            editorType={title}
            editorCodeChanger={handleCodeUpdate}
            disabled={locked}
          />
        </div>
      )}

      <div
        className="codeEditor flex-[1_1_20px] overflow-auto relative min-h-0"
        title={
          locked ? "You can't edit this code" : " Click on the code to edit it"
        }
      >
        {locked && (
          <h3
            id="title"
            className="text-red-500 absolute top-[20%] left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-45 text-5xl opacity-20 z-[1] select-none overflow-hidden drop-shadow-[2px_2px_2px_#000]"
          >
            Locked
          </h3>
        )}
        {title === "HTML" && (
          <div title="You can't edit this code">
            <CodeMirror
              {...cmPropsFirstLine}
              value={"<div id='root'>"}
              style={CodeEditorStyle}
              basicSetup={{
                lineNumbers: false,
                foldGutter: false,
                highlightActiveLine: false,
              }}
            />
          </div>
        )}

        <CodeMirror
          {...cmProps}
          value={code}
          style={{
            overflow: "auto",
            boxSizing: "border-box",
            margin: "0",
            padding: "0",
          }}
        />
        {title === "HTML" && (
          <div title="You can't edit this code">
            <CodeMirror
              {...cmPropsFirstLine}
              value={"</div>"}
              style={CodeEditorStyle}
              basicSetup={{
                lineNumbers: false,
                foldGutter: false,
                highlightActiveLine: false,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
