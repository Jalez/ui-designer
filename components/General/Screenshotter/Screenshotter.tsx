/** @format */

import { useEffect, useRef } from "react";
import { domToPng } from "modern-screenshot";

interface ConditionalScreenshotProps {
  screenshotName: string;
  triggerCondition: string;
  children: React.ReactNode;
  updateScreenshot: (screenshotName: string, dataUrl: string) => void;
  takeScreenshotWhen: boolean;
}

/**
 * @description This component takes a screenshot of its children and passes the screenshot to the updateScreenshot function
 * @param param0
 * @returns
 */
export const ScreenShotter = ({
  screenshotName,
  triggerCondition,
  children,
  updateScreenshot,
  takeScreenshotWhen,
}: ConditionalScreenshotProps) => {
  const screenshotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // console.log("screenshotter useEffect");
    if (!takeScreenshotWhen) return;
    if (!screenshotRef.current) return;
    domToPng(screenshotRef.current, { scale: 1 }).then((dataUrl: string) => {
      updateScreenshot(screenshotName, dataUrl);
    });
  }, [triggerCondition]);

  return <div ref={screenshotRef}>{children}</div>;
};
