"use client";

import { useEffect } from "react";

export function useLtiHeightSync(isLoading: boolean) {
  useEffect(() => {
    if (isLoading) {
      return;
    }

    const targetHeight = 900;
    try {
      window.parent.postMessage({ subject: "lti.frameResize", height: targetHeight }, "*");
      window.parent.postMessage({ type: "a-plus-resize-iframe", height: targetHeight }, "*");
    } catch (error) {
      console.warn("Could not post frameResize message to parent", error);
    }
  }, [isLoading]);
}
