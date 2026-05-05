import * as Y from "yjs";
import * as cmView from "@codemirror/view";
import { ySync, ySyncFacet, YSyncConfig } from "./y-sync";
import { yRemoteSelections, yRemoteSelectionsTheme } from "./y-remote-selections";
import { yUndoManager, yUndoManagerFacet, YUndoManagerConfig, undo, redo, yUndoManagerKeymap } from "./y-undomanager";

export { ySync, ySyncFacet, YSyncConfig, yRemoteSelections, yRemoteSelectionsTheme, yUndoManagerKeymap };

export function yCollab(
  ytext: Y.Text,
  awareness: unknown,
  { undoManager = new Y.UndoManager(ytext) }: { undoManager?: Y.UndoManager | false } = {},
) {
  const ySyncConfig = new YSyncConfig(ytext, awareness);
  const plugins = [ySyncFacet.of(ySyncConfig), ySync];
  if (awareness) {
    plugins.push(yRemoteSelectionsTheme, yRemoteSelections);
  }
  if (undoManager !== false) {
    plugins.push(
      yUndoManagerFacet.of(new YUndoManagerConfig(undoManager)),
      yUndoManager,
      cmView.EditorView.domEventHandlers({
        beforeinput(e, view) {
          if (e.inputType === "historyUndo") return undo(view);
          if (e.inputType === "historyRedo") return redo(view);
          return false;
        },
      }),
    );
  }
  return plugins;
}
