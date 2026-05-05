import * as Y from "yjs";

export class YRange {
  yanchor: Y.RelativePosition;
  yhead: Y.RelativePosition;

  constructor(yanchor: Y.RelativePosition, yhead: Y.RelativePosition) {
    this.yanchor = yanchor;
    this.yhead = yhead;
  }

  toJSON() {
    return {
      yanchor: Y.relativePositionToJSON(this.yanchor),
      yhead: Y.relativePositionToJSON(this.yhead),
    };
  }

  static fromJSON(json: { yanchor: unknown; yhead: unknown }) {
    return new YRange(
      Y.createRelativePositionFromJSON(json.yanchor),
      Y.createRelativePositionFromJSON(json.yhead),
    );
  }
}
