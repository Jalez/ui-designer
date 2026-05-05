export function sanitizeReplayProgressData(
  progressData: Record<string, unknown>,
  replaying: boolean,
  options: { stripLevels?: boolean } = {},
): Record<string, unknown> {
  const stripLevels = options.stripLevels ?? true;
  const sanitized = Object.fromEntries(
    Object.entries(progressData).filter(([key]) => (
      (!stripLevels || key !== "levels")
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
