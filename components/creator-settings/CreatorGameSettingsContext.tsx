"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useGameStore } from "@/components/default/games";
import { useAppSelector } from "@/store/hooks/hooks";
import { apiUrl } from "@/lib/apiUrl";
import {
  buildDefaultAccessWindow,
  DEFAULT_ACCESS_WINDOW_TIMEZONE,
  formatUtcInstantForTimeZoneInput,
  normalizeGameAccessWindows,
  normalizeAccessWindowTimeZone,
  type GameAccessWindow,
} from "@/lib/gameAccessWindows";
import {
  DEFAULT_DRAWBOARD_CAPTURE_MODE,
  DEFAULT_DRAWBOARD_RELOAD_DEBOUNCE_MS,
  DEFAULT_MANUAL_DRAWBOARD_CAPTURE,
  DEFAULT_REMOTE_SYNC_DEBOUNCE_MS,
} from "@/lib/gameRuntimeConfig";

export type Collaborator = {
  user_id: string;
  added_by: string;
  created_at: string;
};

export type SettingsDraft = {
  description: string;
  isPublic: boolean;
  collaborationMode: "individual" | "group";
  allowDuplicateUsers: boolean;
  thumbnailUrl: string;
  hideSidebar: boolean;
  accessWindowEnabled: boolean;
  accessWindowTimezone: string;
  accessWindows: GameAccessWindow[];
  accessKeyRequired: boolean;
  accessKey: string;
  drawboardCaptureMode: "browser" | "playwright";
  manualDrawboardCapture: boolean;
  remoteSyncDebounceMs: number;
  drawboardReloadDebounceMs: number;
  instancePurgeCadence: "daily" | "weekly" | "monthly" | null;
  instancePurgeTimezone: string;
  instancePurgeHour: number;
  instancePurgeMinute: number;
  instancePurgeWeekday: number;
  instancePurgeDayOfMonth: number;
};

type GameShape = {
  id: string;
  title: string;
  description?: string | null;
  isPublic: boolean;
  collaborationMode: "individual" | "group";
  allowDuplicateUsers?: boolean;
  thumbnailUrl: string | null;
  hideSidebar: boolean;
  accessWindowEnabled: boolean;
  accessStartsAt: string | null;
  accessEndsAt: string | null;
  accessWindowTimezone?: string | null;
  accessWindows?: GameAccessWindow[] | null;
  accessKeyRequired: boolean;
  accessKey?: string | null;
  drawboardCaptureMode?: "browser" | "playwright";
  manualDrawboardCapture?: boolean;
  remoteSyncDebounceMs?: number;
  drawboardReloadDebounceMs?: number;
  instancePurgeCadence?: "daily" | "weekly" | "monthly" | null;
  instancePurgeTimezone?: string | null;
  instancePurgeHour?: number | null;
  instancePurgeMinute?: number | null;
  instancePurgeWeekday?: number | null;
  instancePurgeDayOfMonth?: number | null;
  canEdit?: boolean;
  isOwner?: boolean;
  canManageCollaborators?: boolean;
  canRemoveCollaborators?: boolean;
};

type LevelThumbnail = {
  levelName: string;
  scenarioId: string;
  url: string;
};

type CreatorGameSettingsContextValue = {
  gameId: string;
  game: (GameShape & {
    canEdit?: boolean;
    isOwner?: boolean;
    canManageCollaborators?: boolean;
    canRemoveCollaborators?: boolean;
  }) | null;
  draft: SettingsDraft | null;
  initialDraft: SettingsDraft | null;
  isLoading: boolean;
  isSaving: boolean;
  isSavingThumbnail: boolean;
  isPurgingInstances: boolean;
  error: string | null;
  saveError: string | null;
  saveSuccess: string | null;
  thumbnailSaveError: string | null;
  hasChanges: boolean;
  canEdit: boolean;
  canManageCollaborators: boolean;
  canRemoveCollaborators: boolean;
  collaborators: Collaborator[];
  collaboratorEmail: string;
  collaboratorSearch: string;
  collaboratorError: string | null;
  collaboratorSuggestions: { email: string; name: string | null }[];
  loadingSuggestions: boolean;
  collaboratorOptions: { value: string; label: string; keywords?: string[] }[];
  shareUrl: string | null;
  ltiLaunchUrl: string | null;
  purgeScheduleSummary: string;
  copied: boolean;
  copiedLti: boolean;
  copiedAccessKey: boolean;
  levelSolutionThumbnails: LevelThumbnail[];
  setDraft: React.Dispatch<React.SetStateAction<SettingsDraft | null>>;
  setSaveSuccess: React.Dispatch<React.SetStateAction<string | null>>;
  setCollaboratorEmail: React.Dispatch<React.SetStateAction<string>>;
  setCollaboratorSearch: React.Dispatch<React.SetStateAction<string>>;
  handleSave: () => Promise<void>;
  handleCopyLink: () => Promise<void>;
  handleGenerateShareLink: () => Promise<void>;
  handleCopyLtiUrl: () => Promise<void>;
  handleCopyAccessKey: () => Promise<void>;
  handleManualPurge: () => Promise<void>;
  handleSaveThumbnailToServer: () => Promise<void>;
  handleAddCollaborator: () => Promise<void>;
  handleRemoveCollaborator: (email: string) => Promise<void>;
  scenarioLabel: (scenarioId: string) => string;
  createAccessKey: () => string;
};

export type CreatorGameSettingsInitialData = {
  origin: string;
  game: (GameShape & {
    canEdit?: boolean;
    isOwner?: boolean;
    canManageCollaborators?: boolean;
    canRemoveCollaborators?: boolean;
  }) | null;
  collaborators: Collaborator[];
  canEdit: boolean;
  canManageCollaborators: boolean;
  canRemoveCollaborators: boolean;
};

function toUtcIsoFromLocalDateTime(value: string, timeZone: string): string | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const [, year, month, day, hour, minute] = match;
  const utcGuess = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
  const date = new Date(utcGuess);
  const formatted = formatUtcInstantForTimeZoneInput(date, timeZone);

  if (formatted === value) {
    return date.toISOString();
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const targetUtc = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
  const observedUtc = Date.UTC(
    Number(lookup.year),
    Number(lookup.month) - 1,
    Number(lookup.day),
    Number(lookup.hour),
    Number(lookup.minute),
    Number(lookup.second),
  );
  const offsetMs = observedUtc - utcGuess;
  return new Date(targetUtc - offsetMs).toISOString();
}

const CreatorGameSettingsContext = createContext<CreatorGameSettingsContextValue | null>(null);

export const WEEKDAY_OPTIONS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
] as const;

export const DEFAULT_PURGE_TIMEZONE = "Europe/Helsinki";

export function createAccessKey(): string {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

function toIsoOrNull(value: string): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function createDraft(game: GameShape): SettingsDraft {
  const captureMode =
    game.drawboardCaptureMode === "playwright" || game.drawboardCaptureMode === "browser"
      ? game.drawboardCaptureMode
      : DEFAULT_DRAWBOARD_CAPTURE_MODE;
  const debounce =
    typeof game.remoteSyncDebounceMs === "number" && Number.isFinite(game.remoteSyncDebounceMs)
      ? Math.min(10_000, Math.max(0, Math.round(game.remoteSyncDebounceMs)))
      : DEFAULT_REMOTE_SYNC_DEBOUNCE_MS;
  const reloadDebounce =
    typeof game.drawboardReloadDebounceMs === "number" && Number.isFinite(game.drawboardReloadDebounceMs)
      ? Math.min(10_000, Math.max(0, Math.round(game.drawboardReloadDebounceMs)))
      : DEFAULT_DRAWBOARD_RELOAD_DEBOUNCE_MS;

  const accessWindowTimezone = normalizeAccessWindowTimeZone(game.accessWindowTimezone);
  const normalizedAccessWindows = normalizeGameAccessWindows(game.accessWindows);
  const accessWindows =
    normalizedAccessWindows.length > 0
      ? normalizedAccessWindows
      : game.accessStartsAt || game.accessEndsAt
        ? [{
            id: crypto.randomUUID(),
            startsAtLocal: formatUtcInstantForTimeZoneInput(game.accessStartsAt, accessWindowTimezone),
            endsAtLocal: formatUtcInstantForTimeZoneInput(game.accessEndsAt, accessWindowTimezone),
          }]
        : [buildDefaultAccessWindow(new Date(), accessWindowTimezone)];

  return {
    description: game.description ?? "",
    isPublic: game.isPublic,
    collaborationMode: game.collaborationMode,
    allowDuplicateUsers: game.allowDuplicateUsers !== false,
    thumbnailUrl: game.thumbnailUrl ?? "",
    hideSidebar: game.hideSidebar,
    accessWindowEnabled: game.accessWindowEnabled,
    accessWindowTimezone,
    accessWindows,
    accessKeyRequired: game.accessKeyRequired,
    accessKey: game.accessKey ?? "",
    drawboardCaptureMode: captureMode,
    manualDrawboardCapture:
      typeof game.manualDrawboardCapture === "boolean"
        ? game.manualDrawboardCapture
        : DEFAULT_MANUAL_DRAWBOARD_CAPTURE,
    remoteSyncDebounceMs: debounce,
    drawboardReloadDebounceMs: reloadDebounce,
    instancePurgeCadence:
      game.instancePurgeCadence === "daily" || game.instancePurgeCadence === "weekly" || game.instancePurgeCadence === "monthly"
        ? game.instancePurgeCadence
        : null,
    instancePurgeTimezone: game.instancePurgeTimezone?.trim() || DEFAULT_PURGE_TIMEZONE,
    instancePurgeHour:
      typeof game.instancePurgeHour === "number" && Number.isFinite(game.instancePurgeHour)
        ? Math.min(23, Math.max(0, Math.round(game.instancePurgeHour)))
        : 0,
    instancePurgeMinute:
      typeof game.instancePurgeMinute === "number" && Number.isFinite(game.instancePurgeMinute)
        ? Math.min(59, Math.max(0, Math.round(game.instancePurgeMinute)))
        : 0,
    instancePurgeWeekday:
      typeof game.instancePurgeWeekday === "number" && Number.isFinite(game.instancePurgeWeekday)
        ? Math.min(6, Math.max(0, Math.round(game.instancePurgeWeekday)))
        : 1,
    instancePurgeDayOfMonth:
      typeof game.instancePurgeDayOfMonth === "number" && Number.isFinite(game.instancePurgeDayOfMonth)
        ? Math.min(31, Math.max(1, Math.round(game.instancePurgeDayOfMonth)))
        : 1,
  };
}

export function CreatorGameSettingsProvider({
  gameId,
  initialData,
  children,
}: {
  gameId: string;
  initialData: CreatorGameSettingsInitialData;
  children: ReactNode;
}) {
  const { setCurrentGameId, updateGame } = useGameStore();

  const levels = useAppSelector((state) => state.levels);
  const solutionUrls = useAppSelector((state) => state.solutionUrls);

  const [isLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingThumbnail, setIsSavingThumbnail] = useState(false);
  const [isPurgingInstances, setIsPurgingInstances] = useState(false);
  const [error] = useState<string | null>(initialData.game ? null : "Unable to load settings.");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [thumbnailSaveError, setThumbnailSaveError] = useState<string | null>(null);
  const [draft, setDraft] = useState<SettingsDraft | null>(initialData.game ? createDraft(initialData.game) : null);
  const [initialDraft, setInitialDraft] = useState<SettingsDraft | null>(initialData.game ? createDraft(initialData.game) : null);
  const [copied, setCopied] = useState(false);
  const [copiedLti, setCopiedLti] = useState(false);
  const [copiedAccessKey, setCopiedAccessKey] = useState(false);
  const [collaboratorEmail, setCollaboratorEmail] = useState("");
  const [collaboratorSearch, setCollaboratorSearch] = useState("");
  const [collaborators, setCollaborators] = useState<Collaborator[]>(initialData.collaborators);
  const [collaboratorError, setCollaboratorError] = useState<string | null>(null);
  const [collaboratorSuggestions, setCollaboratorSuggestions] = useState<{ email: string; name: string | null }[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [game, setGame] = useState<CreatorGameSettingsInitialData["game"]>(initialData.game);

  useEffect(() => {
    if (!initialData.game) {
      return;
    }
    setCurrentGameId(gameId);
  }, [gameId, initialData.game, setCurrentGameId]);

  useEffect(() => {
    setGame(initialData.game);
    setCollaborators(initialData.collaborators);
    if (initialData.game) {
      const nextDraft = createDraft(initialData.game);
      setDraft(nextDraft);
      setInitialDraft(nextDraft);
    } else {
      setDraft(null);
      setInitialDraft(null);
    }
  }, [initialData]);

  const canEdit = initialData.canEdit;
  const canManageCollaborators = initialData.canManageCollaborators;
  const canRemoveCollaborators = initialData.canRemoveCollaborators;

  const hasChanges = useMemo(() => {
    if (!draft || !initialDraft) return false;
    return JSON.stringify(draft) !== JSON.stringify(initialDraft);
  }, [draft, initialDraft]);

  const purgeScheduleSummary = useMemo(() => {
    if (!draft?.instancePurgeCadence) {
      return "Disabled";
    }

    const timeLabel = `${String(draft.instancePurgeHour).padStart(2, "0")}:${String(draft.instancePurgeMinute).padStart(2, "0")}`;
    const timezone = draft.instancePurgeTimezone.trim() || DEFAULT_PURGE_TIMEZONE;

    if (draft.instancePurgeCadence === "daily") {
      return `Resets every day at ${timeLabel} ${timezone}.`;
    }

    if (draft.instancePurgeCadence === "weekly") {
      const weekday = WEEKDAY_OPTIONS.find((option) => option.value === draft.instancePurgeWeekday)?.label ?? "Monday";
      return `Resets every ${weekday} at ${timeLabel} ${timezone}.`;
    }

    return `Resets on day ${draft.instancePurgeDayOfMonth} of each month at ${timeLabel} ${timezone}.`;
  }, [draft]);

  const origin = initialData.origin;
  const shareUrl = game?.id ? `${origin}/game/${game.id}` : null;
  const ltiLaunchUrl = game?.id ? `${origin}${apiUrl(`/api/lti/game/${game.id}`)}` : null;

  const levelSolutionThumbnails = useMemo(
    () =>
      levels
        .flatMap((level) => {
          const scenarioId = level.scenarios?.find((scenario) => Boolean(solutionUrls[scenario.scenarioId]))?.scenarioId;
          if (!scenarioId) {
            return [];
          }

          return [{
            levelName: String(level.name),
            scenarioId,
            url: solutionUrls[scenarioId] as string,
          }];
        }),
    [levels, solutionUrls],
  );

  const collaboratorOptions = useMemo(() => {
    const fromSuggestions = collaboratorSuggestions.map((suggestion) => ({
      value: suggestion.email,
      label: suggestion.name ? `${suggestion.name} (${suggestion.email})` : suggestion.email,
      keywords: [suggestion.email, suggestion.name || ""],
    }));
    const typed = collaboratorEmail.trim();
    if (typed && !fromSuggestions.some((o) => o.value === typed)) {
      return [{ value: typed, label: typed }, ...fromSuggestions];
    }
    return fromSuggestions;
  }, [collaboratorSuggestions, collaboratorEmail]);

  const scenarioLabel = (scenarioId: string) => {
    for (const level of levels) {
      const scenario = level.scenarios?.find((s) => s.scenarioId === scenarioId);
      if (scenario) return `${level.name} - ${scenarioId}`;
    }
    return scenarioId;
  };

  const handleSave = async () => {
    if (!game || !draft) return;

    if (draft.accessKeyRequired && !draft.accessKey.trim()) {
      setSaveError("Access key is required when access key protection is enabled.");
      return;
    }

    const normalizedAccessWindows = draft.accessWindowEnabled
      ? normalizeGameAccessWindows(draft.accessWindows)
      : [];
  const accessWindowTimezone = normalizeAccessWindowTimeZone(draft.accessWindowTimezone);

    if (draft.accessWindowEnabled && normalizedAccessWindows.length === 0) {
      setSaveError("Add at least one access window or disable access windows.");
      return;
    }

    for (const window of normalizedAccessWindows) {
      if (window.startsAtLocal >= window.endsAtLocal) {
        setSaveError("Each access window must end after it starts.");
        return;
      }
    }

    const firstWindow = normalizedAccessWindows[0] ?? null;
    const lastWindow = normalizedAccessWindows[normalizedAccessWindows.length - 1] ?? null;
    const legacyStartsAt = firstWindow ? toUtcIsoFromLocalDateTime(firstWindow.startsAtLocal, accessWindowTimezone) : null;
    const legacyEndsAt = lastWindow ? toUtcIsoFromLocalDateTime(lastWindow.endsAtLocal, accessWindowTimezone) : null;

    try {
      setIsSaving(true);
      setSaveError(null);
      setSaveSuccess(null);

      await updateGame(game.id, {
        description: draft.description.trim() || null,
        isPublic: draft.isPublic,
        collaborationMode: draft.collaborationMode,
        allowDuplicateUsers: draft.allowDuplicateUsers,
        thumbnailUrl: draft.thumbnailUrl.trim() || null,
        hideSidebar: draft.hideSidebar,
        accessWindowEnabled: draft.accessWindowEnabled,
        accessStartsAt: draft.accessWindowEnabled ? legacyStartsAt : null,
        accessEndsAt: draft.accessWindowEnabled ? legacyEndsAt : null,
        accessWindowTimezone: draft.accessWindowEnabled ? accessWindowTimezone : null,
        accessWindows: draft.accessWindowEnabled ? normalizedAccessWindows : [],
        accessKeyRequired: draft.accessKeyRequired,
        accessKey: draft.accessKeyRequired ? draft.accessKey.trim() : null,
        drawboardCaptureMode: draft.drawboardCaptureMode,
        manualDrawboardCapture: draft.manualDrawboardCapture,
        remoteSyncDebounceMs: draft.remoteSyncDebounceMs,
        drawboardReloadDebounceMs: draft.drawboardReloadDebounceMs,
        instancePurgeCadence: draft.instancePurgeCadence,
        instancePurgeTimezone: draft.instancePurgeCadence ? draft.instancePurgeTimezone.trim() || DEFAULT_PURGE_TIMEZONE : null,
        instancePurgeHour: draft.instancePurgeCadence ? draft.instancePurgeHour : null,
        instancePurgeMinute: draft.instancePurgeCadence ? draft.instancePurgeMinute : null,
        instancePurgeWeekday: draft.instancePurgeCadence === "weekly" ? draft.instancePurgeWeekday : null,
        instancePurgeDayOfMonth: draft.instancePurgeCadence === "monthly" ? draft.instancePurgeDayOfMonth : null,
        instancePurgeLastExecutedAt: null,
      });

      setGame((current) => (current ? {
        ...current,
        description: draft.description.trim() || null,
        isPublic: draft.isPublic,
        collaborationMode: draft.collaborationMode,
        allowDuplicateUsers: draft.allowDuplicateUsers,
        thumbnailUrl: draft.thumbnailUrl.trim() || null,
        hideSidebar: draft.hideSidebar,
        accessWindowEnabled: draft.accessWindowEnabled,
        accessStartsAt: draft.accessWindowEnabled ? legacyStartsAt : null,
        accessEndsAt: draft.accessWindowEnabled ? legacyEndsAt : null,
        accessWindowTimezone: draft.accessWindowEnabled ? accessWindowTimezone : null,
        accessWindows: draft.accessWindowEnabled ? normalizedAccessWindows : [],
        accessKeyRequired: draft.accessKeyRequired,
        accessKey: draft.accessKeyRequired ? draft.accessKey.trim() : null,
        drawboardCaptureMode: draft.drawboardCaptureMode,
        manualDrawboardCapture: draft.manualDrawboardCapture,
        remoteSyncDebounceMs: draft.remoteSyncDebounceMs,
        drawboardReloadDebounceMs: draft.drawboardReloadDebounceMs,
        instancePurgeCadence: draft.instancePurgeCadence,
        instancePurgeTimezone: draft.instancePurgeCadence ? draft.instancePurgeTimezone.trim() || DEFAULT_PURGE_TIMEZONE : null,
        instancePurgeHour: draft.instancePurgeCadence ? draft.instancePurgeHour : null,
        instancePurgeMinute: draft.instancePurgeCadence ? draft.instancePurgeMinute : null,
        instancePurgeWeekday: draft.instancePurgeCadence === "weekly" ? draft.instancePurgeWeekday : null,
        instancePurgeDayOfMonth: draft.instancePurgeCadence === "monthly" ? draft.instancePurgeDayOfMonth : null,
      } : current));
      setInitialDraft(draft);
      setSaveSuccess("Settings saved.");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateShareLink = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyLtiUrl = async () => {
    if (!ltiLaunchUrl) return;
    await navigator.clipboard.writeText(ltiLaunchUrl);
    setCopiedLti(true);
    setTimeout(() => setCopiedLti(false), 2000);
  };

  const handleCopyAccessKey = async () => {
    if (!draft?.accessKey) return;
    await navigator.clipboard.writeText(draft.accessKey);
    setCopiedAccessKey(true);
    setTimeout(() => setCopiedAccessKey(false), 2000);
  };

  const handleManualPurge = async () => {
    if (!game) return;

    try {
      setIsPurgingInstances(true);
      setSaveError(null);
      setSaveSuccess(null);

      const response = await fetch(apiUrl(`/api/games/${game.id}/instances/reset`), {
        method: "POST",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || data.message || "Failed to purge game instances");
      }

      setSaveSuccess(
        typeof data.message === "string" && data.message.trim().length > 0
          ? data.message
          : "Game instances purged.",
      );
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to purge game instances");
    } finally {
      setIsPurgingInstances(false);
    }
  };

  const handleSaveThumbnailToServer = async () => {
    if (!game || !draft?.thumbnailUrl.trim()) {
      return;
    }

    try {
      setIsSavingThumbnail(true);
      setThumbnailSaveError(null);
      setSaveSuccess(null);

      const response = await fetch(apiUrl(`/api/games/${game.id}/thumbnail`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceUrl: draft.thumbnailUrl.trim() }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || data.message || "Failed to save thumbnail");
      }

      const nextThumbnailUrl =
        typeof data.thumbnailUrl === "string" ? data.thumbnailUrl.trim() : "";
      if (!nextThumbnailUrl) {
        throw new Error("Thumbnail save succeeded but no URL was returned");
      }

      setDraft((current) => (current ? { ...current, thumbnailUrl: nextThumbnailUrl } : current));
      setSaveSuccess("Thumbnail saved to server. Save settings to apply it.");
    } catch (err) {
      setThumbnailSaveError(err instanceof Error ? err.message : "Failed to save thumbnail");
    } finally {
      setIsSavingThumbnail(false);
    }
  };

  const handleAddCollaborator = async () => {
    if (!game || !canManageCollaborators || !collaboratorEmail.trim()) return;

    try {
      setCollaboratorError(null);
      const response = await fetch(apiUrl(`/api/games/${game.id}/collaborators`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: collaboratorEmail.trim() }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Failed to add collaborator");
      }

      setCollaborators(Array.isArray(data.collaborators) ? data.collaborators : collaborators);
      setCollaboratorEmail("");
      setCollaboratorSearch("");
    } catch (err) {
      setCollaboratorError(err instanceof Error ? err.message : "Failed to add collaborator");
    }
  };

  const handleRemoveCollaborator = async (email: string) => {
    if (!game || !canRemoveCollaborators) return;

    try {
      setCollaboratorError(null);
      const response = await fetch(apiUrl(`/api/games/${game.id}/collaborators/${encodeURIComponent(email)}`), {
        method: "DELETE",
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Failed to remove collaborator");
      }

      setCollaborators((current) => current.filter((c) => c.user_id !== email));
    } catch (err) {
      setCollaboratorError(err instanceof Error ? err.message : "Failed to remove collaborator");
    }
  };

  useEffect(() => {
    if (!game?.id || !canManageCollaborators) {
      setCollaboratorSuggestions([]);
      setLoadingSuggestions(false);
      return;
    }

    const query = collaboratorSearch.trim();
    if (query.length < 2) {
      setCollaboratorSuggestions([]);
      setLoadingSuggestions(false);
      return;
    }

    const timerId = setTimeout(async () => {
      try {
        setLoadingSuggestions(true);
        const response = await fetch(
          apiUrl(`/api/games/${game.id}/collaborators/suggestions?q=${encodeURIComponent(query)}`),
        );
        if (!response.ok) {
          throw new Error("Failed to load suggestions");
        }
        const data = await response.json();
        setCollaboratorSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
      } catch {
        setCollaboratorSuggestions([]);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 180);

    return () => clearTimeout(timerId);
  }, [collaboratorSearch, canManageCollaborators, game?.id]);

  const value = useMemo<CreatorGameSettingsContextValue>(() => ({
    gameId,
    game,
    draft,
    initialDraft,
    isLoading,
    isSaving,
    isSavingThumbnail,
    isPurgingInstances,
    error,
    saveError,
    saveSuccess,
    thumbnailSaveError,
    hasChanges,
    canEdit,
    canManageCollaborators,
    canRemoveCollaborators,
    collaborators,
    collaboratorEmail,
    collaboratorSearch,
    collaboratorError,
    collaboratorSuggestions,
    loadingSuggestions,
    collaboratorOptions,
    shareUrl,
    ltiLaunchUrl,
    purgeScheduleSummary,
    copied,
    copiedLti,
    copiedAccessKey,
    levelSolutionThumbnails,
    setDraft,
    setSaveSuccess,
    setCollaboratorEmail,
    setCollaboratorSearch,
    handleSave,
    handleCopyLink,
    handleGenerateShareLink,
    handleCopyLtiUrl,
    handleCopyAccessKey,
    handleManualPurge,
    handleSaveThumbnailToServer,
    handleAddCollaborator,
    handleRemoveCollaborator,
    scenarioLabel,
    createAccessKey,
  }), [
    canEdit,
    canManageCollaborators,
    canRemoveCollaborators,
    collaboratorEmail,
    collaboratorError,
    collaboratorOptions,
    collaboratorSearch,
    collaboratorSuggestions,
    collaborators,
    copied,
    copiedAccessKey,
    copiedLti,
    draft,
    error,
    game,
    gameId,
    handleAddCollaborator,
    handleCopyAccessKey,
    handleCopyLink,
    handleCopyLtiUrl,
    handleGenerateShareLink,
    handleManualPurge,
    handleRemoveCollaborator,
    handleSave,
    handleSaveThumbnailToServer,
    hasChanges,
    initialDraft,
    isLoading,
    isSaving,
    isSavingThumbnail,
    isPurgingInstances,
    levelSolutionThumbnails,
    loadingSuggestions,
    ltiLaunchUrl,
    purgeScheduleSummary,
    saveError,
    saveSuccess,
    thumbnailSaveError,
    scenarioLabel,
    shareUrl,
  ]);

  return <CreatorGameSettingsContext.Provider value={value}>{children}</CreatorGameSettingsContext.Provider>;
}

export function useCreatorGameSettings() {
  const context = useContext(CreatorGameSettingsContext);
  if (!context) {
    throw new Error("useCreatorGameSettings must be used within CreatorGameSettingsProvider");
  }
  return context;
}
