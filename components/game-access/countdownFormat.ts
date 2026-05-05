export const ACCESS_CLOSE_WARNING_THRESHOLD_MS = 5 * 60 * 1000;
export const ACCESS_CLOSE_FINAL_COUNTDOWN_MS = 30 * 1000;

export type CountdownPart = {
  label: string;
  value: string;
};

function formatCountdownSegment(value: number): string {
  return String(Math.max(0, value)).padStart(2, "0");
}

export function getCountdownParts(remainingMs: number): CountdownPart[] {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [
    { label: "Days", value: formatCountdownSegment(days) },
    { label: "Hours", value: formatCountdownSegment(hours) },
    { label: "Minutes", value: formatCountdownSegment(minutes) },
    { label: "Seconds", value: formatCountdownSegment(seconds) },
  ];
}

export function formatOpenAt(opensAt: Date, timeZone: string | null): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timeZone || undefined,
    }).format(opensAt);
  } catch {
    return opensAt.toLocaleString();
  }
}

export function formatAccessCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${formatCountdownSegment(minutes)}:${formatCountdownSegment(seconds)}`;
}

export function formatOpeningHeroCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${formatCountdownSegment(days)}:${formatCountdownSegment(hours)}:${formatCountdownSegment(minutes)}:${formatCountdownSegment(seconds)}`;
}
