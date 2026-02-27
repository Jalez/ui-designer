'use client';

import { useState, useCallback, useEffect } from "react";
import {
  Settings,
  Copy,
  Check,
  Globe,
  Lock,
  EyeOff,
  Eye,
  RefreshCw,
  ExternalLink,
  Users,
  UserPlus,
  Trash2,
  KeyRound,
  CalendarClock,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import PoppingTitle from "@/components/General/PoppingTitle";
import { useGameStore } from "@/components/default/games";
import { useAppSelector } from "@/store/hooks/hooks";

function generateToken(): string {
  return crypto.randomUUID();
}

type Collaborator = {
  user_id: string;
  added_by: string;
  created_at: string;
};

function toDateTimeInputValue(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function toIsoOrNull(value: string): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export const GameSettings = () => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedLti, setCopiedLti] = useState(false);
  const [copiedAccessKey, setCopiedAccessKey] = useState(false);
  const [thumbnailInput, setThumbnailInput] = useState("");
  const [collaboratorEmail, setCollaboratorEmail] = useState("");
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [collaboratorError, setCollaboratorError] = useState<string | null>(null);
  const [accessStartsAtInput, setAccessStartsAtInput] = useState("");
  const [accessEndsAtInput, setAccessEndsAtInput] = useState("");

  const { getCurrentGame, updateGame } = useGameStore();
  const solutionUrls = useAppSelector((state) => state.solutionUrls);
  const levels = useAppSelector((state) => state.levels);

  const game = getCurrentGame();
  const canEdit = Boolean(game?.canEdit ?? game?.isOwner);
  const canManageCollaborators = Boolean(game?.canManageCollaborators);
  const canRemoveCollaborators = Boolean(game?.canRemoveCollaborators);

  useEffect(() => {
    if (!open || !game) {
      return;
    }

    setThumbnailInput(game.thumbnailUrl ?? "");
    setAccessStartsAtInput(toDateTimeInputValue(game.accessStartsAt));
    setAccessEndsAtInput(toDateTimeInputValue(game.accessEndsAt));

    if (!canManageCollaborators) {
      return;
    }

    fetch(`/api/games/${game.id}/collaborators`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Failed to load collaborators");
        }
        return res.json();
      })
      .then((data) => {
        setCollaborators(Array.isArray(data.collaborators) ? data.collaborators : []);
      })
      .catch((error: unknown) => {
        setCollaboratorError(error instanceof Error ? error.message : "Failed to load collaborators");
      });
  }, [open, game, canManageCollaborators]);

  const handleOpen = () => {
    setOpen(true);
    setCollaboratorError(null);
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const shareUrl = game?.shareToken ? `${origin}/play/${game.shareToken}` : null;
  const ltiLaunchUrl = game?.shareToken ? `${origin}/api/lti/play/${game.shareToken}` : null;

  const handleTogglePublic = useCallback(async () => {
    if (!game) return;
    await updateGame(game.id, { isPublic: !game.isPublic });
  }, [game, updateGame]);

  const handleSetCollaborationMode = useCallback(
    async (mode: "individual" | "group") => {
      if (!game) return;
      await updateGame(game.id, { collaborationMode: mode });
    },
    [game, updateGame],
  );

  const handleToggleSidebar = useCallback(async () => {
    if (!game) return;
    await updateGame(game.id, { hideSidebar: !game.hideSidebar });
  }, [game, updateGame]);

  const handleGenerateShareLink = useCallback(async () => {
    if (!game) return;
    const token = generateToken();
    await updateGame(game.id, { shareToken: token });
  }, [game, updateGame]);

  const handleCopyLink = useCallback(async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [shareUrl]);

  const handleCopyLtiUrl = useCallback(async () => {
    if (!ltiLaunchUrl) return;
    await navigator.clipboard.writeText(ltiLaunchUrl);
    setCopiedLti(true);
    setTimeout(() => setCopiedLti(false), 2000);
  }, [ltiLaunchUrl]);

  const handleThumbnailUrl = useCallback(async () => {
    if (!game) return;
    await updateGame(game.id, { thumbnailUrl: thumbnailInput || null });
  }, [game, thumbnailInput, updateGame]);

  const handleUseSolutionScreenshot = useCallback(
    async (dataUrl: string) => {
      if (!game) return;
      await updateGame(game.id, { thumbnailUrl: dataUrl });
      setThumbnailInput(dataUrl.startsWith("data:") ? "[Solution screenshot]" : dataUrl);
    },
    [game, updateGame],
  );

  const handleToggleAccessWindow = useCallback(async () => {
    if (!game) return;
    await updateGame(game.id, { accessWindowEnabled: !game.accessWindowEnabled });
  }, [game, updateGame]);

  const handleSaveAccessWindow = useCallback(async () => {
    if (!game) return;
    await updateGame(game.id, {
      accessStartsAt: toIsoOrNull(accessStartsAtInput),
      accessEndsAt: toIsoOrNull(accessEndsAtInput),
    });
  }, [game, accessStartsAtInput, accessEndsAtInput, updateGame]);

  const handleToggleAccessKeyRequired = useCallback(async () => {
    if (!game) return;

    const nextRequired = !game.accessKeyRequired;
    if (nextRequired && !game.accessKey) {
      await updateGame(game.id, { regenerateAccessKey: true, accessKeyRequired: true });
      return;
    }

    await updateGame(game.id, { accessKeyRequired: nextRequired });
  }, [game, updateGame]);

  const handleRegenerateAccessKey = useCallback(async () => {
    if (!game) return;
    await updateGame(game.id, { regenerateAccessKey: true, accessKeyRequired: true });
  }, [game, updateGame]);

  const handleCopyAccessKey = useCallback(async () => {
    if (!game?.accessKey) return;
    await navigator.clipboard.writeText(game.accessKey);
    setCopiedAccessKey(true);
    setTimeout(() => setCopiedAccessKey(false), 2000);
  }, [game?.accessKey]);

  const handleAddCollaborator = useCallback(async () => {
    if (!game || !canManageCollaborators) return;

    try {
      setCollaboratorError(null);
      const response = await fetch(`/api/games/${game.id}/collaborators`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: collaboratorEmail }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Failed to add collaborator");
      }

      setCollaborators(Array.isArray(data.collaborators) ? data.collaborators : collaborators);
      setCollaboratorEmail("");
    } catch (error: unknown) {
      setCollaboratorError(error instanceof Error ? error.message : "Failed to add collaborator");
    }
  }, [game, canManageCollaborators, collaboratorEmail, collaborators]);

  const handleRemoveCollaborator = useCallback(
    async (email: string) => {
      if (!game || !canRemoveCollaborators) return;

      try {
        setCollaboratorError(null);
        const response = await fetch(`/api/games/${game.id}/collaborators/${encodeURIComponent(email)}`, {
          method: "DELETE",
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || "Failed to remove collaborator");
        }

        setCollaborators((current) => current.filter((c) => c.user_id !== email));
      } catch (error: unknown) {
        setCollaboratorError(error instanceof Error ? error.message : "Failed to remove collaborator");
      }
    },
    [game, canRemoveCollaborators],
  );

  const solutionScreenshots = Object.entries(solutionUrls).filter(([, url]) => !!url);

  const scenarioLabel = (scenarioId: string) => {
    for (const level of levels) {
      const scenario = level.scenarios?.find((s) => s.scenarioId === scenarioId);
      if (scenario) return `${level.name} – ${scenarioId}`;
    }
    return scenarioId;
  };

  if (!game || !canEdit) return null;

  return (
    <>
      <PoppingTitle topTitle="Game Settings">
        <Button size="icon" variant="ghost" onClick={handleOpen}>
          <Settings className="h-5 w-5" />
        </Button>
      </PoppingTitle>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="z-[1200] max-w-2xl max-h-[85vh] overflow-y-auto space-y-4">
          <DialogHeader>
            <DialogTitle>Game Settings</DialogTitle>
          </DialogHeader>

          <div className="space-y-1">
            <p className="text-sm font-semibold">Visibility</p>
            <Button variant="outline" className="w-full justify-start gap-2" onClick={handleTogglePublic}>
              {game.isPublic ? (
                <>
                  <Globe className="h-4 w-4" /> Public
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" /> Private
                </>
              )}
              <span className="ml-auto text-xs text-muted-foreground">
                {game.isPublic ? "Visible in public games" : "Only invited creators can edit"}
              </span>
            </Button>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-semibold flex items-center gap-2">
              <UsersRound className="h-4 w-4" /> Work Mode
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={game.collaborationMode === "individual" ? "default" : "outline"}
                className="w-full"
                onClick={() => handleSetCollaborationMode("individual")}
              >
                Individual
              </Button>
              <Button
                variant={game.collaborationMode === "group" ? "default" : "outline"}
                className="w-full"
                onClick={() => handleSetCollaborationMode("group")}
              >
                Group
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Group mode routes users with a group to a shared multiplayer workspace. Individual mode keeps everyone in their own instance.
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-semibold">Share Link</p>
            {shareUrl ? (
              <div className="flex gap-2">
                <Input readOnly value={shareUrl} className="text-xs h-9" />
                <Button size="icon" variant="outline" className="shrink-0 h-9 w-9" onClick={handleCopyLink}>
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="shrink-0 h-9 w-9"
                  onClick={handleGenerateShareLink}
                  title="Regenerate link"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button variant="outline" className="w-full" onClick={handleGenerateShareLink}>
                Generate Share Link
              </Button>
            )}
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

          <div className="space-y-1">
            <p className="text-sm font-semibold">Sidebar for Players</p>
            <Button variant="outline" className="w-full justify-start gap-2" onClick={handleToggleSidebar}>
              {game.hideSidebar ? (
                <>
                  <EyeOff className="h-4 w-4" /> Hidden
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4" /> Visible
                </>
              )}
              <span className="ml-auto text-xs text-muted-foreground">
                {game.hideSidebar ? "Sidebar hidden when entering via link" : "Sidebar visible"}
              </span>
            </Button>
          </div>

          <div className="space-y-2 border rounded-md p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold flex items-center gap-2">
                <CalendarClock className="h-4 w-4" /> Access Window
              </p>
              <Button variant="outline" size="sm" onClick={handleToggleAccessWindow}>
                {game.accessWindowEnabled ? "Enabled" : "Disabled"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Optionally limit when share-link players can open this game.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <Input type="datetime-local" value={accessStartsAtInput} onChange={(event) => setAccessStartsAtInput(event.target.value)} />
              <Input type="datetime-local" value={accessEndsAtInput} onChange={(event) => setAccessEndsAtInput(event.target.value)} />
            </div>
            <Button variant="outline" size="sm" onClick={handleSaveAccessWindow}>
              Save Window
            </Button>
          </div>

          <div className="space-y-2 border rounded-md p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold flex items-center gap-2">
                <KeyRound className="h-4 w-4" /> Access Key
              </p>
              <Button variant="outline" size="sm" onClick={handleToggleAccessKeyRequired}>
                {game.accessKeyRequired ? "Required" : "Not required"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              When required, players need this key in addition to the share link.
            </p>
            <div className="flex gap-2">
              <Input readOnly value={game.accessKey || "No key generated"} className="font-mono text-xs" />
              <Button size="icon" variant="outline" onClick={handleCopyAccessKey} disabled={!game.accessKey}>
                {copiedAccessKey ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
              <Button size="sm" variant="outline" onClick={handleRegenerateAccessKey}>
                <RefreshCw className="h-4 w-4 mr-1" /> Regenerate
              </Button>
            </div>
          </div>

          <div className="space-y-2 border rounded-md p-3">
            <p className="text-sm font-semibold flex items-center gap-2">
              <Users className="h-4 w-4" /> Creator Access
            </p>
            <p className="text-xs text-muted-foreground">
              Add fellow creators who can edit this game. Original creator keeps ultimate rights.
            </p>

            {canManageCollaborators ? (
              <div className="flex gap-2">
                <Input
                  value={collaboratorEmail}
                  onChange={(event) => setCollaboratorEmail(event.target.value)}
                  placeholder="creator@example.com"
                />
                <Button variant="outline" onClick={handleAddCollaborator}>
                  <UserPlus className="h-4 w-4 mr-1" /> Add
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">You can edit this game but cannot manage collaborators.</p>
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
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold">Thumbnail</p>
            {game.thumbnailUrl && (
              <div className="relative rounded-md overflow-hidden border h-24 bg-muted">
                <img src={game.thumbnailUrl} alt="Thumbnail preview" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="flex gap-2">
              <Input
                placeholder="Paste image URL…"
                value={thumbnailInput.startsWith("data:") ? "" : thumbnailInput}
                onChange={(e) => setThumbnailInput(e.target.value)}
                className="h-9 text-sm"
              />
              <Button size="sm" variant="outline" onClick={handleThumbnailUrl} className="shrink-0">
                Set
              </Button>
            </div>
            {solutionScreenshots.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Or use a solution screenshot:</p>
                <div className="flex flex-wrap gap-2">
                  {solutionScreenshots.map(([scenarioId, url]) => (
                    <button
                      key={scenarioId}
                      title={scenarioLabel(scenarioId)}
                      onClick={() => handleUseSolutionScreenshot(url as string)}
                      className="relative rounded border overflow-hidden w-20 h-14 hover:ring-2 ring-primary transition"
                    >
                      <img src={url as string} alt={scenarioLabel(scenarioId)} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
