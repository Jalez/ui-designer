"use client";

import {
  CalendarClock,
  Check,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  Lock,
  Plus,
  RefreshCw,
  Trash2,
  UserPlus,
  Users,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { buildDefaultAccessWindow } from "@/lib/gameAccessWindows";
import {
  createAccessKey,
  DEFAULT_PURGE_TIMEZONE,
  type SettingsDraft,
  useCreatorGameSettings,
  WEEKDAY_OPTIONS,
} from "./CreatorGameSettingsContext";
import {
  DEFAULT_DRAWBOARD_RELOAD_DEBOUNCE_MS,
  DEFAULT_REMOTE_SYNC_DEBOUNCE_MS,
} from "@/lib/gameRuntimeConfig";

function getDatePart(value: string): string {
  return value.includes("T") ? value.slice(0, 10) : "";
}

function getTimePart(value: string): string {
  return value.includes("T") ? value.slice(11, 16) : "";
}

function combineDateAndTime(date: string, time: string): string {
  if (!date) return "";
  return `${date}T${time || "00:00"}`;
}

export function BasicsSettingsSection() {
  const { draft, setDraft, setSaveSuccess, levelSolutionThumbnails, scenarioLabel } = useCreatorGameSettings();
  if (!draft) return null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Description</CardTitle>
          <CardDescription>Shown on public game cards instead of the internal map identifier.</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={draft.description}
            onChange={(event) => {
              setDraft((current) => (current ? { ...current, description: event.target.value } : current));
              setSaveSuccess(null);
            }}
            placeholder="Add a short description for this game..."
            className="min-h-[120px]"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Visibility</CardTitle>
          <CardDescription>Choose whether this game is public or private.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={() => {
              setDraft((current) => (current ? { ...current, isPublic: !current.isPublic } : current));
              setSaveSuccess(null);
            }}
          >
            {draft.isPublic ? <Globe className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            <span>{draft.isPublic ? "Public" : "Private"}</span>
            <span className="ml-auto text-xs text-muted-foreground">
              {draft.isPublic ? "Visible in public games" : "Only invited creators can edit"}
            </span>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UsersRound className="h-4 w-4" /> Work Mode
          </CardTitle>
          <CardDescription>Group mode routes users to shared workspace. Individual mode isolates players.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={draft.collaborationMode === "individual" ? "default" : "outline"}
              onClick={() => {
                setDraft((current) => (current ? { ...current, collaborationMode: "individual" } : current));
                setSaveSuccess(null);
              }}
            >
              Individual
            </Button>
            <Button
              variant={draft.collaborationMode === "group" ? "default" : "outline"}
              onClick={() => {
                setDraft((current) => (current ? { ...current, collaborationMode: "group" } : current));
                setSaveSuccess(null);
              }}
            >
              Group
            </Button>
          </div>
          <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Allow duplicate users</p>
                <p className="text-xs text-muted-foreground">
                  On by default. Allows multiple browser sessions for the same account.
                </p>
              </div>
              <Switch
                checked={draft.allowDuplicateUsers}
                onCheckedChange={(checked) => {
                  setDraft((current) => (current ? { ...current, allowDuplicateUsers: checked } : current));
                  setSaveSuccess(null);
                }}
              />
            </div>
            {!draft.allowDuplicateUsers && (
              <p className="text-xs text-amber-700">
                Duplicate sessions are blocked. Players opening a second browser tab or window will be disconnected.
                {draft.collaborationMode === "group" && " In group mode, this also blocks the same account from joining multiple group rooms."}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Thumbnail</CardTitle>
          <CardDescription>Set custom thumbnail URL or use a generated level solution. Recommended size: 300 x 300.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {draft.thumbnailUrl && (
            <div className="relative aspect-square w-full max-w-[300px] rounded-md overflow-hidden border bg-muted">
              <img src={draft.thumbnailUrl} alt="Thumbnail preview" className="w-full h-full object-cover" />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="thumbnail-url">Thumbnail URL</Label>
            <Input
              id="thumbnail-url"
              value={draft.thumbnailUrl}
              onChange={(event) => {
                setDraft((current) => (current ? { ...current, thumbnailUrl: event.target.value } : current));
                setSaveSuccess(null);
              }}
              placeholder="https://..."
            />
          </div>
          {levelSolutionThumbnails.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Or use a level solution as the thumbnail:</p>
              <div className="flex flex-wrap gap-2">
                {levelSolutionThumbnails.map(({ levelName, scenarioId, url }) => (
                  <button
                    key={scenarioId}
                    title={scenarioLabel(scenarioId)}
                    onClick={() => {
                      setDraft((current) => (current ? { ...current, thumbnailUrl: url } : current));
                      setSaveSuccess(null);
                    }}
                    className="relative rounded border overflow-hidden w-24 h-24 hover:ring-2 ring-primary transition"
                  >
                    <img src={url} alt={scenarioLabel(scenarioId)} className="w-full h-full object-cover" />
                    <span className="absolute inset-x-0 bottom-0 bg-background/85 px-1 py-0.5 text-[10px] font-medium truncate">
                      {levelName}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function AccessSettingsSection() {
  const {
    draft,
    setDraft,
    setSaveSuccess,
    shareUrl,
    ltiLaunchUrl,
    copied,
    copiedLti,
    copiedAccessKey,
    handleCopyLink,
    handleGenerateShareLink,
    handleCopyLtiUrl,
    handleCopyAccessKey,
  } = useCreatorGameSettings();
  if (!draft) return null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Share Link</CardTitle>
          <CardDescription>Copy a player link for this game.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input readOnly value={shareUrl || ""} className="text-xs h-9" />
            <Button size="icon" variant="outline" className="shrink-0 h-9 w-9" onClick={handleCopyLink}>
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="shrink-0 h-9 w-9"
              title="Copy link"
              onClick={handleGenerateShareLink}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {ltiLaunchUrl && (
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <p className="text-sm font-semibold">A+ LTI Launch URL</p>
                <ExternalLink className="h-3 w-3 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground">
                Use this as the Launch URL in A+ / Moodle to identify users and post grades.
              </p>
              <div className="flex gap-2">
                <Input readOnly value={ltiLaunchUrl} className="text-xs h-9" />
                <Button size="icon" variant="outline" className="shrink-0 h-9 w-9" onClick={handleCopyLtiUrl}>
                  {copiedLti ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sidebar for Players</CardTitle>
          <CardDescription>Applied on gameplay routes.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div className="flex items-center gap-2 text-sm">
              {draft.hideSidebar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              <span>{draft.hideSidebar ? "Hide sidebar for players" : "Show sidebar for players"}</span>
            </div>
            <Switch
              checked={draft.hideSidebar}
              onCheckedChange={(checked) => {
                setDraft((current) => (current ? { ...current, hideSidebar: checked } : current));
                setSaveSuccess(null);
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarClock className="h-4 w-4" /> Access Windows
          </CardTitle>
          <CardDescription>
            Define exact opening periods in one timezone. Players in other timezones still open the game at the same real moment.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-md border p-3">
            <span className="text-sm font-medium">Enable access windows</span>
            <Switch
              checked={draft.accessWindowEnabled}
              onCheckedChange={(checked) => {
                setDraft((current) => (current ? { ...current, accessWindowEnabled: checked } : current));
                setSaveSuccess(null);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="access-window-timezone">Timezone</Label>
            <Input
              id="access-window-timezone"
              value={draft.accessWindowTimezone}
              onChange={(event) => {
                setDraft((current) => (current ? { ...current, accessWindowTimezone: event.target.value } : current));
                setSaveSuccess(null);
              }}
              placeholder="Europe/Helsinki"
              spellCheck={false}
            />
            <p className="text-xs text-muted-foreground">
              Use an IANA timezone like <code>Europe/Helsinki</code> or <code>UTC</code>.
            </p>
          </div>
          <div className="space-y-3">
            {draft.accessWindows.map((window, index) => {
              const startDate = getDatePart(window.startsAtLocal);
              const startTime = getTimePart(window.startsAtLocal);
              const endDate = getDatePart(window.endsAtLocal);
              const endTime = getTimePart(window.endsAtLocal);

              return (
                <div key={window.id} className="rounded-md border p-3 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">Window {index + 1}</p>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => {
                        setDraft((current) => (
                          current
                            ? { ...current, accessWindows: current.accessWindows.filter((entry) => entry.id !== window.id) }
                            : current
                        ));
                        setSaveSuccess(null);
                      }}
                      disabled={draft.accessWindows.length <= 1}
                      title={draft.accessWindows.length <= 1 ? "Keep at least one window while access windows are enabled." : "Remove window"}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Start</Label>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <Input
                          type="date"
                          value={startDate}
                          onChange={(event) => {
                            const nextDate = event.target.value;
                            setDraft((current) =>
                              current
                                ? {
                                    ...current,
                                    accessWindows: current.accessWindows.map((entry) =>
                                      entry.id === window.id
                                        ? { ...entry, startsAtLocal: combineDateAndTime(nextDate, getTimePart(entry.startsAtLocal)) }
                                        : entry,
                                    ),
                                  }
                                : current,
                            );
                            setSaveSuccess(null);
                          }}
                        />
                        <Input
                          type="time"
                          step={60}
                          value={startTime}
                          onChange={(event) => {
                            const nextTime = event.target.value;
                            setDraft((current) =>
                              current
                                ? {
                                    ...current,
                                    accessWindows: current.accessWindows.map((entry) =>
                                      entry.id === window.id
                                        ? { ...entry, startsAtLocal: combineDateAndTime(getDatePart(entry.startsAtLocal), nextTime) }
                                        : entry,
                                    ),
                                  }
                                : current,
                            );
                            setSaveSuccess(null);
                          }}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>End</Label>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <Input
                          type="date"
                          value={endDate}
                          onChange={(event) => {
                            const nextDate = event.target.value;
                            setDraft((current) =>
                              current
                                ? {
                                    ...current,
                                    accessWindows: current.accessWindows.map((entry) =>
                                      entry.id === window.id
                                        ? { ...entry, endsAtLocal: combineDateAndTime(nextDate, getTimePart(entry.endsAtLocal)) }
                                        : entry,
                                    ),
                                  }
                                : current,
                            );
                            setSaveSuccess(null);
                          }}
                        />
                        <Input
                          type="time"
                          step={60}
                          value={endTime}
                          onChange={(event) => {
                            const nextTime = event.target.value;
                            setDraft((current) =>
                              current
                                ? {
                                    ...current,
                                    accessWindows: current.accessWindows.map((entry) =>
                                      entry.id === window.id
                                        ? { ...entry, endsAtLocal: combineDateAndTime(getDatePart(entry.endsAtLocal), nextTime) }
                                        : entry,
                                    ),
                                  }
                                : current,
                            );
                            setSaveSuccess(null);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <Button
              variant="outline"
              className="w-full justify-center gap-2"
              onClick={() => {
                const today = draft.accessWindows[draft.accessWindows.length - 1];
                const nextWindow = today
                  ? {
                      id: crypto.randomUUID(),
                      startsAtLocal: today.startsAtLocal,
                      endsAtLocal: today.endsAtLocal,
                    }
                  : buildDefaultAccessWindow(new Date(), draft.accessWindowTimezone);
                setDraft((current) =>
                  current ? { ...current, accessWindows: [...current.accessWindows, nextWindow] } : current,
                );
                setSaveSuccess(null);
              }}
            >
              <Plus className="h-4 w-4" />
              Add Access Window
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="h-4 w-4" /> Access Key
          </CardTitle>
          <CardDescription>Require and manage access key for share-link players.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-md border p-3">
            <span className="text-sm font-medium">Require access key</span>
            <Switch
              checked={draft.accessKeyRequired}
              onCheckedChange={(checked) => {
                setDraft((current) => (current ? { ...current, accessKeyRequired: checked } : current));
                setSaveSuccess(null);
              }}
            />
          </div>
          <div className="flex gap-2">
            <Input
              value={draft.accessKey}
              onChange={(event) => {
                setDraft((current) => (current ? { ...current, accessKey: event.target.value } : current));
                setSaveSuccess(null);
              }}
              className="font-mono text-xs"
              placeholder="No key generated"
            />
            <Button size="icon" variant="outline" onClick={handleCopyAccessKey} disabled={!draft.accessKey}>
              {copiedAccessKey ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setDraft((current) =>
                  current ? { ...current, accessKeyRequired: true, accessKey: createAccessKey() } : current,
                );
                setSaveSuccess(null);
              }}
            >
              <RefreshCw className="h-4 w-4 mr-1" /> Regenerate
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function RuntimeSettingsSection() {
  const { draft, setDraft, setSaveSuccess, purgeScheduleSummary, handleManualPurge, isPurgingInstances } = useCreatorGameSettings();
  if (!draft) return null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Scheduled instance purge</CardTitle>
          <CardDescription>
            Automatically wipes saved game instances, variant assignments, scores, and leaderboard history on a fixed schedule.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Enable scheduled purge</p>
              <p className="text-xs text-muted-foreground">
                The reset is applied on the next load or refresh after the scheduled time. Active sessions are not interrupted immediately.
              </p>
            </div>
            <Switch
              checked={draft.instancePurgeCadence !== null}
              onCheckedChange={(checked) => {
                setDraft((current) => (
                  current
                    ? {
                        ...current,
                        instancePurgeCadence: checked ? (current.instancePurgeCadence ?? "daily") : null,
                      }
                    : current
                ));
                setSaveSuccess(null);
              }}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="instance-purge-cadence">Cadence</Label>
              <Select
                value={draft.instancePurgeCadence ?? ""}
                onValueChange={(value) => {
                  setDraft((current) =>
                    current
                      ? {
                          ...current,
                          instancePurgeCadence: (value || null) as SettingsDraft["instancePurgeCadence"],
                        }
                      : current,
                  );
                  setSaveSuccess(null);
                }}
                disabled={draft.instancePurgeCadence === null}
              >
                <SelectTrigger id="instance-purge-cadence">
                  <SelectValue placeholder="Choose cadence" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="instance-purge-timezone">Timezone</Label>
              <Input
                id="instance-purge-timezone"
                value={draft.instancePurgeTimezone}
                disabled={draft.instancePurgeCadence === null}
                onChange={(event) => {
                  const value = event.target.value;
                  setDraft((current) =>
                    current ? { ...current, instancePurgeTimezone: value } : current,
                  );
                  setSaveSuccess(null);
                }}
                placeholder={DEFAULT_PURGE_TIMEZONE}
                className="max-w-sm"
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="instance-purge-hour">Hour</Label>
              <Input
                id="instance-purge-hour"
                type="number"
                min={0}
                max={23}
                step={1}
                inputMode="numeric"
                disabled={draft.instancePurgeCadence === null}
                value={draft.instancePurgeHour}
                onChange={(event) => {
                  const raw = Number(event.target.value);
                  setDraft((current) =>
                    current
                      ? { ...current, instancePurgeHour: Number.isFinite(raw) ? Math.min(23, Math.max(0, Math.round(raw))) : 0 }
                      : current,
                  );
                  setSaveSuccess(null);
                }}
                className="max-w-xs"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="instance-purge-minute">Minute</Label>
              <Input
                id="instance-purge-minute"
                type="number"
                min={0}
                max={59}
                step={1}
                inputMode="numeric"
                disabled={draft.instancePurgeCadence === null}
                value={draft.instancePurgeMinute}
                onChange={(event) => {
                  const raw = Number(event.target.value);
                  setDraft((current) =>
                    current
                      ? { ...current, instancePurgeMinute: Number.isFinite(raw) ? Math.min(59, Math.max(0, Math.round(raw))) : 0 }
                      : current,
                  );
                  setSaveSuccess(null);
                }}
                className="max-w-xs"
              />
            </div>
            {draft.instancePurgeCadence === "weekly" && (
              <div className="space-y-2">
                <Label htmlFor="instance-purge-weekday">Weekday</Label>
                <Select
                  value={String(draft.instancePurgeWeekday)}
                  onValueChange={(value) => {
                    setDraft((current) =>
                      current ? { ...current, instancePurgeWeekday: Number(value) } : current,
                    );
                    setSaveSuccess(null);
                  }}
                >
                  <SelectTrigger id="instance-purge-weekday">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WEEKDAY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={String(option.value)}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {draft.instancePurgeCadence === "monthly" && (
              <div className="space-y-2">
                <Label htmlFor="instance-purge-day">Day of month</Label>
                <Input
                  id="instance-purge-day"
                  type="number"
                  min={1}
                  max={31}
                  step={1}
                  inputMode="numeric"
                  value={draft.instancePurgeDayOfMonth}
                  onChange={(event) => {
                    const raw = Number(event.target.value);
                    setDraft((current) =>
                      current
                        ? { ...current, instancePurgeDayOfMonth: Number.isFinite(raw) ? Math.min(31, Math.max(1, Math.round(raw))) : 1 }
                        : current,
                    );
                    setSaveSuccess(null);
                  }}
                  className="max-w-xs"
                />
              </div>
            )}
          </div>
          <div className="rounded-md border bg-muted/40 p-3 space-y-1">
            <p className="text-sm font-medium">Schedule summary</p>
            <p className="text-xs text-muted-foreground">{purgeScheduleSummary}</p>
            <p className="text-xs text-muted-foreground">
              A purge clears saved instances, scores, leaderboards, and variant assignments for the whole game.
            </p>
            <div className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPurgingInstances}
                onClick={() => {
                  if (typeof window !== "undefined") {
                    const confirmed = window.confirm(
                      "Purge all saved game instances for this game now? This clears saved progress, scores, leaderboards, and variant assignments.",
                    );
                    if (!confirmed) {
                      return;
                    }
                  }
                  void handleManualPurge();
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {isPurgingInstances ? "Purging..." : "Purge now"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Drawboard and editor sync</CardTitle>
          <CardDescription>
            How artboard screenshots are captured and how quickly editor changes sync to previews. Applies after you save; no server restart.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="drawboard-capture-mode">Capture mode</Label>
            <Select
              value={draft.drawboardCaptureMode}
              onValueChange={(value: "browser" | "playwright") => {
                setDraft((current) =>
                  current ? { ...current, drawboardCaptureMode: value } : current,
                );
                setSaveSuccess(null);
              }}
            >
              <SelectTrigger id="drawboard-capture-mode" className="max-w-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="browser">Browser (default)</SelectItem>
                <SelectItem value="playwright">Playwright (server render)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Browser uses canvas export in the iframe; Playwright renders on the server.
            </p>
          </div>
          <div className="flex items-center justify-between rounded-md border p-3 gap-3">
            <div>
              <p className="text-sm font-medium">Manual drawboard capture</p>
              <p className="text-xs text-muted-foreground">
                When on, snapshots run only when you use Capture on each artboard (default off: capture on edit).
              </p>
            </div>
            <Switch
              checked={draft.manualDrawboardCapture}
              onCheckedChange={(checked) => {
                setDraft((current) =>
                  current ? { ...current, manualDrawboardCapture: checked } : current,
                );
                setSaveSuccess(null);
              }}
            />
          </div>
          <div className="space-y-2 max-w-md">
            <Label htmlFor="remote-sync-debounce">Remote sync debounce (ms)</Label>
            <Input
              id="remote-sync-debounce"
              type="number"
              min={0}
              max={10_000}
              value={draft.remoteSyncDebounceMs}
              onChange={(event) => {
                const parsed = Number.parseInt(event.target.value, 10);
                const next = Number.isFinite(parsed)
                  ? Math.min(10_000, Math.max(0, parsed))
                  : DEFAULT_REMOTE_SYNC_DEBOUNCE_MS;
                setDraft((current) =>
                  current ? { ...current, remoteSyncDebounceMs: next } : current,
                );
                setSaveSuccess(null);
              }}
            />
            <p className="text-xs text-muted-foreground">
              Delay before Yjs and drawboard capture mirror into Redux (0–10000 ms). Default 500.
            </p>
          </div>
          <div className="space-y-2 max-w-md">
            <Label htmlFor="drawboard-reload-debounce">Drawboard reload debounce (ms)</Label>
            <Input
              id="drawboard-reload-debounce"
              type="number"
              min={0}
              max={10_000}
              value={draft.drawboardReloadDebounceMs}
              onChange={(event) => {
                const parsed = Number.parseInt(event.target.value, 10);
                const next = Number.isFinite(parsed)
                  ? Math.min(10_000, Math.max(0, parsed))
                  : DEFAULT_DRAWBOARD_RELOAD_DEBOUNCE_MS;
                setDraft((current) =>
                  current ? { ...current, drawboardReloadDebounceMs: next } : current,
                );
                setSaveSuccess(null);
              }}
            />
            <p className="text-xs text-muted-foreground">
              Delay before the drawboard iframe reloads after editor changes (0–10000 ms). Default 48.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function CollaboratorsSettingsSection() {
  const {
    canManageCollaborators,
    canRemoveCollaborators,
    collaboratorEmail,
    collaboratorSearch,
    collaboratorError,
    collaboratorSuggestions,
    collaborators,
    collaboratorOptions,
    loadingSuggestions,
    setCollaboratorEmail,
    setCollaboratorSearch,
    handleAddCollaborator,
    handleRemoveCollaborator,
  } = useCreatorGameSettings();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" /> Creator Access
          </CardTitle>
          <CardDescription>Add or remove collaborators who can edit this game.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {canManageCollaborators ? (
            <div className="flex gap-2">
              <div className="flex-1">
                <Combobox
                  value={collaboratorEmail.trim() || undefined}
                  inputValue={collaboratorSearch}
                  onInputChange={(v) => {
                    setCollaboratorSearch(v);
                    if (collaboratorEmail && v.length > 0) {
                      setCollaboratorEmail("");
                    }
                  }}
                  onValueChange={(email) => {
                    setCollaboratorEmail(email);
                    setCollaboratorSearch("");
                  }}
                  options={collaboratorOptions}
                  isLoading={loadingSuggestions}
                  loadingText="Loading collaborators..."
                  placeholder="Select collaborator"
                  searchPlaceholder="Type name or email..."
                  emptyText="No users found"
                  renderValue={(selected) => selected?.label || "Select collaborator"}
                />
              </div>
              <Button variant="outline" onClick={handleAddCollaborator}>
                <UserPlus className="h-4 w-4 mr-1" /> Add
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">You can edit this game but cannot manage collaborators.</p>
          )}

          {canManageCollaborators && collaboratorSearch.trim().length >= 2 && (
            <p className="text-xs text-muted-foreground">
              {loadingSuggestions
                ? "Searching users..."
                : collaboratorSuggestions.length > 0
                  ? "Suggestions available in the collaborator dropdown."
                  : "No matching users found."}
            </p>
          )}

          {collaboratorError && <p className="text-xs text-red-600">{collaboratorError}</p>}

          <div className="space-y-1">
            {collaborators.length === 0 ? (
              <p className="text-xs text-muted-foreground">No additional creators yet.</p>
            ) : (
              collaborators.map((collaborator) => (
                <div key={collaborator.user_id} className="flex items-center justify-between border rounded px-2 py-1 text-sm">
                  <span className="font-mono text-xs">{collaborator.user_id}</span>
                  {canRemoveCollaborators && (
                    <Button size="icon" variant="ghost" onClick={() => handleRemoveCollaborator(collaborator.user_id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
