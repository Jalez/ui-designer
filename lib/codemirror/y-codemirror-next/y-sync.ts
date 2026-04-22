import * as Y from "yjs";
import * as cmState from "@codemirror/state";
import * as cmView from "@codemirror/view";
import { YRange } from "./y-range";

export class YSyncConfig {
  ytext: Y.Text;
  awareness: unknown;
  undoManager: Y.UndoManager;

  constructor(ytext: Y.Text, awareness: unknown) {
    this.ytext = ytext;
    this.awareness = awareness;
    this.undoManager = new Y.UndoManager(ytext);
  }

  toYPos(pos: number, assoc = 0) {
    return Y.createRelativePositionFromTypeIndex(this.ytext, pos, assoc);
  }

  fromYPos(rpos: Y.RelativePosition | object) {
    const pos = Y.createAbsolutePositionFromRelativePosition(
      Y.createRelativePositionFromJSON(rpos),
      this.ytext.doc,
    );
    if (pos == null || pos.type !== this.ytext) {
      throw new Error("[y-codemirror] The position you want to retrieve was created by a different document");
    }
    return {
      pos: pos.index,
      assoc: pos.assoc,
    };
  }

  toYRange(range: cmState.SelectionRange) {
    const assoc = range.assoc;
    const yanchor = this.toYPos(range.anchor, assoc);
    const yhead = this.toYPos(range.head, assoc);
    return new YRange(yanchor, yhead);
  }

  fromYRange(yrange: YRange) {
    const anchor = this.fromYPos(yrange.yanchor);
    const head = this.fromYPos(yrange.yhead);
    if (anchor.pos === head.pos) {
      return cmState.EditorSelection.cursor(head.pos, head.assoc);
    }
    return cmState.EditorSelection.range(anchor.pos, head.pos);
  }
}

export const ySyncFacet = cmState.Facet.define<YSyncConfig, YSyncConfig>({
  combine(inputs) {
    return inputs[inputs.length - 1];
  },
});

export const ySyncAnnotation = cmState.Annotation.define<YSyncConfig>();

class YSyncPluginValue {
  view: cmView.EditorView;
  conf: YSyncConfig;
  _observer: (event: Y.YTextEvent, tr: Y.Transaction) => void;
  _ytext: Y.Text;

  constructor(view: cmView.EditorView) {
    this.view = view;
    this.conf = view.state.facet(ySyncFacet);
    this._observer = (event, tr) => {
      if (tr.origin !== this.conf) {
        const delta = event.delta;
        const changes: { from: number; to: number; insert: string }[] = [];
        let pos = 0;
        for (let i = 0; i < delta.length; i += 1) {
          const d = delta[i] as { insert?: string; delete?: number; retain?: number };
          if (d.insert != null) {
            changes.push({ from: pos, to: pos, insert: d.insert });
          } else if (d.delete != null) {
            changes.push({ from: pos, to: pos + d.delete, insert: "" });
            pos += d.delete;
          } else {
            pos += d.retain ?? 0;
          }
        }
        view.dispatch({ changes, annotations: [ySyncAnnotation.of(this.conf)] });
      }
    };
    this._ytext = this.conf.ytext;
    this._ytext.observe(this._observer);
  }

  update(update: cmView.ViewUpdate) {
    if (
      !update.docChanged
      || (update.transactions.length > 0 && update.transactions[0].annotation(ySyncAnnotation) === this.conf)
    ) {
      return;
    }
    const ytext = this.conf.ytext;
    ytext.doc?.transact(() => {
      let adj = 0;
      update.changes.iterChanges((fromA, toA, _fromB, _toB, insert) => {
        const insertText = insert.sliceString(0, insert.length, "\n");
        if (fromA !== toA) {
          ytext.delete(fromA + adj, toA - fromA);
        }
        if (insertText.length > 0) {
          ytext.insert(fromA + adj, insertText);
        }
        adj += insertText.length - (toA - fromA);
      });
    }, this.conf);
  }

  destroy() {
    this._ytext.unobserve(this._observer);
  }
}

export const ySync = cmView.ViewPlugin.fromClass(YSyncPluginValue);
