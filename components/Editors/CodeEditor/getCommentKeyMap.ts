import { EditorView } from "@codemirror/view";

const commentSyntax = {
  HTML: {
    lineComment: "<!-- -->",
    blockCommentStart: "<!--",
    blockCommentEnd: "-->",
  },
  JS: {
    lineComment: "//",
    blockCommentStart: "/*",
    blockCommentEnd: "*/",
  },
  CSS: {
    lineComment: "//",
    blockCommentStart: "/*",
    blockCommentEnd: "*/",
  },

  // Add other languages and their comment syntax here
};

export function getCommentKeymap(lang: "HTML" | "CSS" | "JS") {
  const syntax = commentSyntax[lang];
  if (!syntax) return [];

  return [
    {
      key: "Ctrl-'",
      run: (view: EditorView) => {
        const { main } = view.state.selection;
        const startLine = view.state.doc.lineAt(main.from).from;
        const endLine = view.state.doc.lineAt(main.to).to;
        // if line is already commented, uncomment it
        const line = view.state.doc.sliceString(startLine, endLine);
        if (line.startsWith(syntax.blockCommentStart)) {
          // uncomment
          view.dispatch({
            changes: [
              {
                from: startLine,
                to: startLine + syntax.blockCommentStart.length,
                insert: "",
              },
              {
                from: endLine - syntax.blockCommentEnd.length,
                to: endLine,
                insert: "",
              },
            ],
          });
          return true;
        }

        // Check if there is a selection
        if (main.empty) {
          // No selection: apply block comment to the entire line
          view.dispatch({
            changes: [
              { from: startLine, insert: syntax.blockCommentStart },
              { from: endLine, insert: syntax.blockCommentEnd },
            ],
          });
        } else {
          // There is a selection: apply block comment to the selected text
          view.dispatch({
            changes: [
              { from: startLine, insert: syntax.blockCommentStart + "\n" },
              { from: endLine, insert: "\n" + syntax.blockCommentEnd },
            ],
          });
        }
        return true;
      },
    },
    // for apple users: cmd + ' to comment line
    {
      key: "Cmd-'",
      run: (view: EditorView) => {
        const { main } = view.state.selection;
        const startLine = view.state.doc.lineAt(main.from).from;
        const endLine = view.state.doc.lineAt(main.to).to;
        // if line is already commented, uncomment it
        const line = view.state.doc.sliceString(startLine, endLine);
        if (line.startsWith(syntax.blockCommentStart)) {
          // uncomment
          view.dispatch({
            changes: [
              {
                from: startLine,
                to: startLine + syntax.blockCommentStart.length,
                insert: "",
              },
              {
                from: endLine - syntax.blockCommentEnd.length,
                to: endLine,
                insert: "",
              },
            ],
          });
          return true;
        }

        // Check if there is a selection
        if (main.empty) {
          // No selection: apply block comment to the entire line
          view.dispatch({
            changes: [
              { from: startLine, insert: syntax.blockCommentStart },
              { from: endLine, insert: syntax.blockCommentEnd },
            ],
          });
        } else {
          // There is a selection: apply block comment to the selected text
          view.dispatch({
            changes: [
              { from: startLine, insert: syntax.blockCommentStart + "\n" },
              { from: endLine, insert: "\n" + syntax.blockCommentEnd },
            ],
          });
        }
        return true;
      },
    },
    // ctrl + l to select entire line
    {
      key: "Ctrl-l",
      run: (view: EditorView) => {
        const { main } = view.state.selection;
        const startLine = view.state.doc.lineAt(main.from).from;
        const endLine = view.state.doc.lineAt(main.to).to;
        view.dispatch({
          selection: {
            anchor: startLine,
            head: endLine,
          },
        });
        return true;
      },
    },
    // for apple users: cmd + l to select entire line
    {
      key: "Cmd-l",
      run: (view: EditorView) => {
        const { main } = view.state.selection;
        const startLine = view.state.doc.lineAt(main.from).from;
        const endLine = view.state.doc.lineAt(main.to).to;
        view.dispatch({
          selection: {
            anchor: startLine,
            head: endLine,
          },
        });
        return true;
      },
    },
  ];
}
