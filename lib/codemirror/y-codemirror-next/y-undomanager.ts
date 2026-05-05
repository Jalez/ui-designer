import * as Y from "yjs";
import * as cmState from "@codemirror/state";
import * as cmView from "@codemirror/view";
import { ySyncFacet, ySyncAnnotation } from "./y-sync";
import { createMutex } from "lib0/mutex";

type SyncConfigLike = {
  ytext: Y.Text;
  fromYRange: (range: unknown) => cmState.SelectionRange;
  toYRange: (range: cmState.SelectionRange) => unknown;
};

type StackItemLike = {
  meta: Map<unknown, unknown>;
};

type StackItemEventLike = {
  stackItem: StackItemLike;
  changedParentTypes: Set<unknown>;
};

export class YUndoManagerConfig {
  undoManager: Y.UndoManager;

  constructor(undoManager: Y.UndoManager) {
    this.undoManager = undoManager;
  }

  addTrackedOrigin(origin: unknown) {
    this.undoManager.addTrackedOrigin(origin);
  }

  removeTrackedOrigin(origin: unknown) {
    this.undoManager.removeTrackedOrigin(origin);
  }

  undo() {
    return this.undoManager.undo() != null;
  }

  redo() {
    return this.undoManager.redo() != null;
  }
}

export const yUndoManagerFacet = cmState.Facet.define<YUndoManagerConfig, YUndoManagerConfig>({
  combine(inputs) {
    return inputs[inputs.length - 1];
  },
});

export const yUndoManagerAnnotation = cmState.Annotation.define<YUndoManagerConfig>();

class YUndoManagerPluginValue {
  view: cmView.EditorView;
  conf: YUndoManagerConfig;
  _undoManager: Y.UndoManager;
  syncConf: SyncConfigLike;
  _beforeChangeSelection: unknown;
  _mux: ReturnType<typeof createMutex>;
  _onStackItemAdded: ({ stackItem, changedParentTypes }: StackItemEventLike) => void;
  _onStackItemPopped: ({ stackItem }: StackItemEventLike) => void;
  _storeSelection: () => void;

  constructor(view: cmView.EditorView) {
    this.view = view;
    this.conf = view.state.facet(yUndoManagerFacet);
    this._undoManager = this.conf.undoManager;
    this.syncConf = view.state.facet(ySyncFacet) as unknown as SyncConfigLike;
    this._beforeChangeSelection = null;
    this._mux = createMutex();

    this._onStackItemAdded = ({ stackItem, changedParentTypes }) => {
      if (changedParentTypes.has(this.syncConf.ytext) && this._beforeChangeSelection && !stackItem.meta.has(this)) {
        stackItem.meta.set(this, this._beforeChangeSelection);
      }
    };
    this._onStackItemPopped = ({ stackItem }) => {
      const sel = stackItem.meta.get(this);
      if (sel) {
        const selection = this.syncConf.fromYRange(sel);
        view.dispatch(view.state.update({
          selection,
          effects: [cmView.EditorView.scrollIntoView(selection)],
        }));
        this._storeSelection();
      }
    };
    this._storeSelection = () => {
      this._beforeChangeSelection = this.syncConf.toYRange(this.view.state.selection.main);
    };
    this._undoManager.on("stack-item-added", this._onStackItemAdded as (arg0: unknown, arg1: Y.UndoManager) => void);
    this._undoManager.on("stack-item-popped", this._onStackItemPopped as (arg0: unknown, arg1: Y.UndoManager) => void);
    this._undoManager.addTrackedOrigin(this.syncConf);
  }

  update(update: cmView.ViewUpdate) {
    if (
      update.selectionSet
      && (update.transactions.length === 0 || update.transactions[0].annotation(ySyncAnnotation) !== (this.syncConf as unknown))
    ) {
      this._storeSelection();
    }
  }

  destroy() {
    this._undoManager.off("stack-item-added", this._onStackItemAdded as (arg0: unknown, arg1: Y.UndoManager) => void);
    this._undoManager.off("stack-item-popped", this._onStackItemPopped as (arg0: unknown, arg1: Y.UndoManager) => void);
    this._undoManager.removeTrackedOrigin(this.syncConf);
  }
}

export const yUndoManager = cmView.ViewPlugin.fromClass(YUndoManagerPluginValue);

export const undo: cmState.StateCommand = ({ state }) => state.facet(yUndoManagerFacet).undo() || true;
export const redo: cmState.StateCommand = ({ state }) => state.facet(yUndoManagerFacet).redo() || true;

export const yUndoManagerKeymap: cmView.KeyBinding[] = [
  { key: "Mod-z", run: undo, preventDefault: true },
  { key: "Mod-y", mac: "Mod-Shift-z", run: redo, preventDefault: true },
  { key: "Mod-Shift-z", run: redo, preventDefault: true },
];
