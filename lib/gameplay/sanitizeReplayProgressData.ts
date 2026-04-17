export function sanitizeReplayProgressData(
  progressData: Record<string, unknown>,
  replaying: boolean,
): Record<string, unknown> {
  const sanitized = Object.fromEntries(
    Object.entries(progressData).filter(([key]) => (
      key !== "levels"
      && key !== "ltiGradeRefreshAt"
      && key !== "resetNotice"
    )),
  );

  if (replaying) {
    delete sanitized.finishedAt;
    delete sanitized.finalScore;
  }

  return sanitized;
}
