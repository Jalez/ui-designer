"use client";

import { toast } from "sonner";
import type { FrameRuntimeWarning } from "@/components/ArtBoards/Frame";

function getFrameLabel(frameName: string): string {
  switch (frameName) {
    case "drawingUrl":
      return "Drawing iframe";
    case "solutionUrl":
      return "Solution iframe";
    default:
      return `${frameName || "Unknown"} iframe`;
  }
}

export function showDrawboardRuntimeWarning(scenarioId: string, warning: FrameRuntimeWarning) {
  const frameLabel = getFrameLabel(warning.frameName);
  const toastId = `${scenarioId}:${warning.frameName}:${warning.type}`;
  toast.dismiss(toastId);
  window.setTimeout(() => {
    toast.warning(`${frameLabel}: ${warning.message}`, {
      id: toastId,
      duration: 8000,
    });
  }, 0);
}
