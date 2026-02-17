"use client";

import { useEffect, useState } from "react";
import { Copy, Eye, EyeOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/tailwind/ui/button";
import { Input } from "@/components/tailwind/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/tailwind/ui/dialog";

interface LtiCredentials {
  consumerKey: string;
  consumerSecret: string;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button variant="outline" size="sm" onClick={handleCopy} className="shrink-0">
      <Copy className="h-3.5 w-3.5 mr-1" />
      {copied ? "Copied!" : "Copy"}
    </Button>
  );
}

export function LtiSetupSection() {
  const [credentials, setCredentials] = useState<LtiCredentials | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const launchUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/lti/launch`
      : "/api/lti/launch";

  useEffect(() => {
    fetch("/api/lti/credentials")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load credentials");
        return res.json();
      })
      .then((data) => {
        setCredentials(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const handleRegenerate = async () => {
    setRegenerating(true);
    setDialogOpen(false);
    try {
      const res = await fetch("/api/lti/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "regenerate" }),
      });
      if (!res.ok) throw new Error("Failed to regenerate secret");
      const data = await res.json();
      setCredentials(data);
      setShowSecret(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="rounded-lg border p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">LTI Integration</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Enter these values in your LMS (Moodle, Canvas, etc.) when adding an External Tool.
        </p>
      </div>

      {loading && (
        <p className="text-sm text-muted-foreground">Loading credentials…</p>
      )}

      {error && (
        <p className="text-sm text-destructive">Error: {error}</p>
      )}

      {credentials && (
        <div className="space-y-4">
          {/* Launch URL */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Launch URL</label>
            <div className="flex gap-2">
              <Input readOnly value={launchUrl} className="font-mono text-sm" />
              <CopyButton value={launchUrl} />
            </div>
          </div>

          {/* Consumer Key */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Consumer Key</label>
            <div className="flex gap-2">
              <Input readOnly value={credentials.consumerKey} className="font-mono text-sm" />
              <CopyButton value={credentials.consumerKey} />
            </div>
          </div>

          {/* Consumer Secret */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Consumer Secret</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  readOnly
                  type={showSecret ? "text" : "password"}
                  value={credentials.consumerSecret}
                  className="font-mono text-sm pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showSecret ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <CopyButton value={credentials.consumerSecret} />
            </div>
          </div>

          {/* Regenerate */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={regenerating}>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                {regenerating ? "Regenerating…" : "Regenerate Secret"}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Regenerate Consumer Secret?</DialogTitle>
                <DialogDescription>
                  This will invalidate your current secret. Any LMS configured with the old secret
                  will stop working until you update it. The consumer key stays the same.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleRegenerate}>
                  Regenerate
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
}
