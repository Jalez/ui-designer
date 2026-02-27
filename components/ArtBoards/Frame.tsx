/** @format */
'use client';

import { useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { scenario } from "@/types";
import { addSolutionUrl } from "@/store/slices/solutionUrls.slice";
import { cn } from "@/lib/utils/cn";

interface FrameProps {
  newHtml: string;
  newCss: string;
  newJs: string;
  events: string[];
  id: string;
  name: string;
  frameUrl?: string;
  scenario: scenario;
}

export const Frame = ({
  id,
  newHtml,
  newCss,
  newJs,
  name,
  events,
  scenario,
  frameUrl = process.env.NEXT_PUBLIC_DRAWBOARD_URL || "http://localhost:3500",
}: FrameProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const dispatch = useAppDispatch();
  const { currentLevel } = useAppSelector((state: any) => state.currentLevel);
  const counterRef = useRef({ reloads: 0, mounts: 0, data: 0, lastLog: Date.now() });

  const level = useAppSelector((state: any) => state.levels[currentLevel - 1]);
  const interactive = level.interactive;
  useEffect(() => {
    const resendDataAfterMount = (event: MessageEvent) => {
      if (event.data === "mounted") {
        counterRef.current.mounts++;
        const now = Date.now();
        if (now - counterRef.current.lastLog > 5000) {
          console.log(`[Frame:${name}] 5s stats: reloads=${counterRef.current.reloads} mounts=${counterRef.current.mounts} data=${counterRef.current.data}`);
          counterRef.current = { reloads: 0, mounts: 0, data: 0, lastLog: now };
        }
        iframeRef.current?.contentWindow?.postMessage(
          {
            html: newHtml,
            css: newCss,
            js: newJs,
            events: JSON.stringify(events),
            scenarioId: scenario.scenarioId,
            name,
            interactive,
          },
          "*"
        );
      }
    };

    window.addEventListener("message", resendDataAfterMount);

    return () => {
      window.removeEventListener("message", resendDataAfterMount);
    };
  }, [newHtml, newCss, name, newJs, scenario, interactive, events]);

  useEffect(() => {
    const handleDataFromIframe = async (event: MessageEvent) => {
      if (!event.data.dataURL) return;
      if (event.data.message !== "data") return;
      dispatch(
        addSolutionUrl({
          solutionUrl: event.data.dataURL,
          scenarioId: event.data.scenarioId,
        })
      );
    };

    window.addEventListener("message", handleDataFromIframe);

    return () => {
      window.removeEventListener("message", handleDataFromIframe);
    };
  }, [currentLevel, dispatch]);

  useEffect(() => {
    const iframe = iframeRef.current;
    counterRef.current.reloads++;
    if (iframe) {
      iframeRef.current?.contentWindow?.postMessage(
        {
          message: "reload",
          name,
        },
        "*"
      );
    }
  }, [newHtml, newCss, iframeRef, newJs, name, interactive]);
  if (!scenario) {
    return <div>Scenario not found</div>;
  }
  return (
    <iframe
      id={id}
      ref={iframeRef}
      src={`${frameUrl}?name=${name}&scenarioId=${scenario.scenarioId}&width=${scenario.dimensions.width}&height=${scenario.dimensions.height}`}
      width={scenario.dimensions.width}
      height={scenario.dimensions.height}
      className={cn(
        "overflow-hidden m-0 p-0 border-none bg-secondary absolute top-0 left-0 z-0 transition-[z-index] duration-300 ease-in-out"
      )}
      style={{
        width: `${scenario.dimensions.width}px`,
        height: `${scenario.dimensions.height}px`,
      }}
    />
  );
};
