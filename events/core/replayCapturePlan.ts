import type {
  BoardStepFreshness,
  ReplayArtboardKind,
  ReplayBoardCapture,
} from "@/events/core/artboardReplayRuntimeStore";

export type ReplayCaptureStepInput = {
  stepId: string;
  drawingUrl: string | null | undefined;
  solutionUrl: string | null | undefined;
};

export type ReplayCapturePlan = {
  captureStepIdsByBoard: Record<ReplayArtboardKind, string[]>;
  reusableCaptures: Array<Omit<ReplayBoardCapture, "runId">>;
};

type ReplayCapturePlanInput = {
  drawingFreshnessByStep: Record<string, BoardStepFreshness | undefined>;
  solutionFreshnessByStep: Record<string, BoardStepFreshness | undefined>;
  steps: ReplayCaptureStepInput[];
};

function getFreshReusableCapture(input: {
  board: ReplayArtboardKind;
  freshness: BoardStepFreshness | undefined;
  stepId: string;
  url: string | null | undefined;
}): Omit<ReplayBoardCapture, "runId"> | null {
  const url = input.url?.trim();
  const freshnessUrl = input.freshness?.imageUrl?.trim();
  if (
    !url
    || !freshnessUrl
    || url !== freshnessUrl
    || input.freshness?.isReady !== true
    || input.freshness.isStale
    || input.freshness.capturedAt == null
  ) {
    return null;
  }

  return {
    board: input.board,
    capturedAt: input.freshness.capturedAt,
    imageUrl: freshnessUrl,
    stepId: input.stepId,
  };
}

export function buildReplayCapturePlan({
  drawingFreshnessByStep,
  solutionFreshnessByStep,
  steps,
}: ReplayCapturePlanInput): ReplayCapturePlan {
  const captureStepIdsByBoard: ReplayCapturePlan["captureStepIdsByBoard"] = {
    drawing: [],
    solution: [],
  };
  const reusableCaptures: ReplayCapturePlan["reusableCaptures"] = [];

  for (const step of steps) {
    const drawingReusable = getFreshReusableCapture({
      board: "drawing",
      freshness: drawingFreshnessByStep[step.stepId],
      stepId: step.stepId,
      url: step.drawingUrl,
    });
    if (drawingReusable) {
      reusableCaptures.push(drawingReusable);
    } else {
      captureStepIdsByBoard.drawing.push(step.stepId);
    }

    const solutionReusable = getFreshReusableCapture({
      board: "solution",
      freshness: solutionFreshnessByStep[step.stepId],
      stepId: step.stepId,
      url: step.solutionUrl,
    });
    if (solutionReusable) {
      reusableCaptures.push(solutionReusable);
    } else {
      captureStepIdsByBoard.solution.push(step.stepId);
    }
  }

  return {
    captureStepIdsByBoard,
    reusableCaptures,
  };
}
