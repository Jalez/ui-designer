'use client';

import { useState, useEffect, useCallback } from "react";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAppSelector } from "@/store/hooks/hooks";
import PoppingTitle from "@/components/General/PoppingTitle";

interface LtiSessionInfo {
  isLtiMode: boolean;
  hasOutcomeService: boolean;
  isInIframe: boolean;
  courseName: string | null;
  returnUrl: string | null;
  role: string;
}

export const AplusSubmitButton = () => {
  const [ltiInfo, setLtiInfo] = useState<LtiSessionInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null);

  const points = useAppSelector((state) => state.points);

  useEffect(() => {
    fetch("/api/games/lti-session")
      .then((res) => res.json())
      .then((data) => {
        setLtiInfo(data);
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, []);

  const handleSubmitGrade = useCallback(async () => {
    if (!ltiInfo?.hasOutcomeService) return;

    setIsSubmitting(true);
    setResult(null);

    try {
      const response = await fetch("/api/games/submit-grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          points: points.allPoints,
          maxPoints: points.allMaxPoints,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setResult({ success: true, message: data.message });
        setShowDialog(false);

        if (data.isInIframe && window.parent) {
          setTimeout(() => {
            window.parent.postMessage({ type: "a-plus-refresh-stats" }, "*");
            if (window.top) {
              window.top.location.reload();
            }
          }, 500);
        }
      } else {
        setResult({ success: false, error: data.error || "Failed to submit grade" });
      }
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : "Failed to submit grade",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [ltiInfo, points.allPoints, points.allMaxPoints]);

  if (isLoading || !ltiInfo?.isLtiMode || !ltiInfo.hasOutcomeService) {
    return null;
  }

  const percentage = points.allMaxPoints > 0
    ? Math.round((points.allPoints / points.allMaxPoints) * 100)
    : 0;

  return (
    <>
      <PoppingTitle topTitle="Submit to A+">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setShowDialog(true)}
          title="Submit grade to A+"
        >
          <Send className="h-5 w-5" />
        </Button>
      </PoppingTitle>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="z-[1200]">
          <DialogHeader>
            <DialogTitle>Submit Grade to A+</DialogTitle>
            <DialogDescription>
              Your score will be submitted to A+ (Plussa).
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="bg-muted rounded-lg p-4 text-center">
              <div className="text-3xl font-bold">
                {points.allPoints} / {points.allMaxPoints}
              </div>
              <div className="text-lg text-muted-foreground mt-1">
                {percentage}%
              </div>
            </div>

            {ltiInfo.courseName && (
              <p className="text-sm text-muted-foreground mt-4">
                Course: <strong>{ltiInfo.courseName}</strong>
              </p>
            )}

            <p className="text-sm text-muted-foreground mt-2">
              You can resubmit to update your score.
            </p>

            {result && (
              <div className={`mt-4 p-3 rounded-lg ${result.success ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200" : "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200"}`}>
                {result.success ? result.message : result.error}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowDialog(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitGrade}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Grade"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
