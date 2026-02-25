'use client';

import { useState, useCallback } from "react";
import { Settings, Copy, Check, Globe, Lock, EyeOff, Eye, RefreshCw, ExternalLink } from "lucide-react";
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
import { useSession } from "next-auth/react";

function generateToken(): string {
  return crypto.randomUUID();
}

export const GameSettings = () => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedLti, setCopiedLti] = useState(false);
  const [thumbnailInput, setThumbnailInput] = useState("");

  const { getCurrentGame, updateGame } = useGameStore();
  const solutionUrls = useAppSelector((state) => state.solutionUrls);
  const levels = useAppSelector((state) => state.levels);
  const { data: session } = useSession();

  const game = getCurrentGame();
  const isGameOwner = game?.userId && (session?.userId === game.userId || session?.user?.email === game.userId);

  if (!game || !isGameOwner) return null;

  const handleOpen = () => {
    setOpen(true);
    setThumbnailInput(game?.thumbnailUrl ?? "");
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const shareUrl = game?.shareToken ? `${origin}/play/${game.shareToken}` : null;
  const ltiLaunchUrl = game?.shareToken ? `${origin}/api/lti/play/${game.shareToken}` : null;

  const handleTogglePublic = useCallback(async () => {
    if (!game) return;
    await updateGame(game.id, { isPublic: !game.isPublic });
  }, [game, updateGame]);

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

  const handleUseSolutionScreenshot = useCallback(async (dataUrl: string) => {
    if (!game) return;
    await updateGame(game.id, { thumbnailUrl: dataUrl });
    setThumbnailInput(dataUrl.startsWith("data:") ? "[Solution screenshot]" : dataUrl);
  }, [game, updateGame]);

  const solutionScreenshots = Object.entries(solutionUrls).filter(([, url]) => !!url);

  const scenarioLabel = (scenarioId: string) => {
    for (const level of levels) {
      const scenario = level.scenarios?.find((s) => s.scenarioId === scenarioId);
      if (scenario) return `${level.name} – ${scenarioId}`;
    }
    return scenarioId;
  };

  return (
    <>
      <PoppingTitle topTitle="Game Settings">
        <Button size="icon" variant="ghost" onClick={handleOpen}>
          <Settings className="h-5 w-5" />
        </Button>
      </PoppingTitle>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="z-[1200] max-w-md space-y-4">
          <DialogHeader>
            <DialogTitle>Game Settings</DialogTitle>
          </DialogHeader>

          <div className="space-y-1">
            <p className="text-sm font-semibold">Visibility</p>
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={handleTogglePublic}
            >
              {game.isPublic ? (
                <><Globe className="h-4 w-4" /> Public</>
              ) : (
                <><Lock className="h-4 w-4" /> Private</>
              )}
              <span className="ml-auto text-xs text-muted-foreground">
                {game.isPublic ? "Visible in public games" : "Only you can access"}
              </span>
            </Button>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-semibold">Share Link</p>
            {shareUrl ? (
              <div className="flex gap-2">
                <Input readOnly value={shareUrl} className="text-xs h-9" />
                <Button size="icon" variant="outline" className="shrink-0 h-9 w-9" onClick={handleCopyLink}>
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button size="icon" variant="ghost" className="shrink-0 h-9 w-9" onClick={handleGenerateShareLink} title="Regenerate link">
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
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={handleToggleSidebar}
            >
              {game.hideSidebar ? (
                <><EyeOff className="h-4 w-4" /> Hidden</>
              ) : (
                <><Eye className="h-4 w-4" /> Visible</>
              )}
              <span className="ml-auto text-xs text-muted-foreground">
                {game.hideSidebar ? "Sidebar hidden when entering via link" : "Sidebar visible"}
              </span>
            </Button>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold">Thumbnail</p>
            {game.thumbnailUrl && (
              <div className="relative rounded-md overflow-hidden border h-24 bg-muted">
                <img
                  src={game.thumbnailUrl}
                  alt="Thumbnail preview"
                  className="w-full h-full object-cover"
                />
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
