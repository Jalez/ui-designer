import { withTransaction } from "@/app/api/_lib/db";
import { purgeGameDrawboardArtifacts } from "@/app/api/_lib/services/drawboardArtifactCacheService";


type PurgeCadence = "daily" | "weekly" | "monthly";

type PurgeConfig = {
  gameId: string;
  instancePurgeCadence: PurgeCadence | null | undefined;
  instancePurgeTimezone: string | null | undefined;
  instancePurgeHour: number | null | undefined;
  instancePurgeMinute: number | null | undefined;
  instancePurgeWeekday: number | null | undefined;
  instancePurgeDayOfMonth: number | null | undefined;
  instancePurgeLastExecutedAt: Date | string | null | undefined;
};

type LocalDateParts = {
  year: number;
  month: number;
  day: number;
  weekday: number;
  hour: number;
  minute: number;
};

const DEFAULT_PURGE_TIMEZONE = "Europe/Helsinki";

function getWsAdminUrl(): string {
  const explicit = process.env.WS_SERVER_HTTP_URL;
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }

  const configuredWsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL;
  if (configuredWsUrl) {
    return configuredWsUrl.replace(/^ws:\/\//, "http://").replace(/^wss:\/\//, "https://").replace(/\/$/, "");
  }

  return "http://localhost:3100";
}

async function invalidateWsGameInstanceRooms(gameId: string): Promise<void> {
  try {
    const response = await fetch(`${getWsAdminUrl()}/admin/reset-game-instances`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-ws-service-token": process.env.WS_SERVICE_TOKEN || "",
      },
      body: JSON.stringify({
        gameId,
        reason: "scheduled_instance_purge",
      }),
      cache: "no-store",
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      console.error("[scheduled-instance-purge:ws-invalidation-failed]", payload);
    }
  } catch (error) {
    console.error("[scheduled-instance-purge:ws-invalidation-error]", error);
  }
}

function normalizeCadence(value: PurgeConfig["instancePurgeCadence"]): PurgeCadence | null {
  return value === "daily" || value === "weekly" || value === "monthly" ? value : null;
}

function normalizeTimezone(value: string | null | undefined): string | null {
  const timezone = value?.trim() || DEFAULT_PURGE_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return timezone;
  } catch {
    return null;
  }
}

function normalizeDate(value: Date | string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function clampInt(value: number | null | undefined, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(value)));
}

function getLocalDateParts(date: Date, timeZone: string): LocalDateParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const weekdayLabel = read("weekday");
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return {
    year: Number(read("year")),
    month: Number(read("month")),
    day: Number(read("day")),
    weekday: weekdayMap[weekdayLabel] ?? 0,
    hour: Number(read("hour")),
    minute: Number(read("minute")),
  };
}

function toUtcDate(parts: { year: number; month: number; day: number; hour: number; minute: number }, timeZone: string): Date {
  const utcGuess = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0, 0));
  const zonedGuess = new Date(utcGuess.toLocaleString("en-US", { timeZone }));
  return new Date(utcGuess.getTime() + (utcGuess.getTime() - zonedGuess.getTime()));
}

function shiftLocalDate(parts: { year: number; month: number; day: number }, days: number) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function shiftLocalMonth(parts: { year: number; month: number }, offset: number) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1 + offset, 1));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
  };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function getLatestScheduledBoundary(config: {
  cadence: PurgeCadence;
  timeZone: string;
  hour: number;
  minute: number;
  weekday: number;
  dayOfMonth: number;
  now: Date;
}): Date {
  const localNow = getLocalDateParts(config.now, config.timeZone);

  if (config.cadence === "daily") {
    let candidate = toUtcDate(
      { year: localNow.year, month: localNow.month, day: localNow.day, hour: config.hour, minute: config.minute },
      config.timeZone,
    );
    if (candidate.getTime() > config.now.getTime()) {
      const previous = shiftLocalDate(localNow, -1);
      candidate = toUtcDate({ ...previous, hour: config.hour, minute: config.minute }, config.timeZone);
    }
    return candidate;
  }

  if (config.cadence === "weekly") {
    const delta = config.weekday - localNow.weekday;
    let localDate = shiftLocalDate(localNow, delta);
    let candidate = toUtcDate({ ...localDate, hour: config.hour, minute: config.minute }, config.timeZone);
    if (candidate.getTime() > config.now.getTime()) {
      localDate = shiftLocalDate(localDate, -7);
      candidate = toUtcDate({ ...localDate, hour: config.hour, minute: config.minute }, config.timeZone);
    }
    return candidate;
  }

  let targetDay = Math.min(config.dayOfMonth, daysInMonth(localNow.year, localNow.month));
  let candidate = toUtcDate(
    { year: localNow.year, month: localNow.month, day: targetDay, hour: config.hour, minute: config.minute },
    config.timeZone,
  );
  if (candidate.getTime() > config.now.getTime()) {
    const previousMonth = shiftLocalMonth(localNow, -1);
    targetDay = Math.min(config.dayOfMonth, daysInMonth(previousMonth.year, previousMonth.month));
    candidate = toUtcDate(
      { year: previousMonth.year, month: previousMonth.month, day: targetDay, hour: config.hour, minute: config.minute },
      config.timeZone,
    );
  }
  return candidate;
}

export async function ensureGameRetentionWindow(
  config: PurgeConfig,
): Promise<{ purged: boolean; boundaryAt: Date | null }> {
  const cadence = normalizeCadence(config.instancePurgeCadence);
  if (!cadence) {
    return { purged: false, boundaryAt: null };
  }

  const timeZone = normalizeTimezone(config.instancePurgeTimezone);
  if (!timeZone) {
    return { purged: false, boundaryAt: null };
  }

  const hour = clampInt(config.instancePurgeHour, 0, 23, 0);
  const minute = clampInt(config.instancePurgeMinute, 0, 59, 0);
  const weekday = clampInt(config.instancePurgeWeekday, 0, 6, 1);
  const dayOfMonth = clampInt(config.instancePurgeDayOfMonth, 1, 31, 1);
  const lastExecutedAt = normalizeDate(config.instancePurgeLastExecutedAt);
  const now = new Date();
  const boundaryAt = getLatestScheduledBoundary({
    cadence,
    timeZone,
    hour,
    minute,
    weekday,
    dayOfMonth,
    now,
  });

  if (boundaryAt.getTime() > now.getTime()) {
    return { purged: false, boundaryAt: null };
  }

  if (lastExecutedAt && lastExecutedAt.getTime() >= boundaryAt.getTime()) {
    return { purged: false, boundaryAt };
  }

  await withTransaction(async (client) => {
    await client.query("DELETE FROM game_attempts WHERE game_id = $1", [config.gameId]);
    await client.query("DELETE FROM game_instances WHERE game_id = $1", [config.gameId]);
    await client.query(
      "UPDATE projects SET instance_purge_last_executed_at = $2, updated_at = NOW() WHERE id = $1",
      [config.gameId, boundaryAt],
    );
  });


  await purgeGameDrawboardArtifacts(config.gameId);
  await invalidateWsGameInstanceRooms(config.gameId);

  return { purged: true, boundaryAt };
}
