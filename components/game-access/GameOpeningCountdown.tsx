'use client';

import { useEffect, useRef, useState } from "react";
import {
  formatOpenAt,
  formatOpeningHeroCountdown,
  getCountdownParts,
} from "@/components/game-access/countdownFormat";
import {
  OPENING_COUNTDOWN_FONT_FAMILY,
  OpeningCountdownSnapText,
} from "@/components/game-access/OpeningCountdownSnapText";

const MIN_FONT_SIZE_PX = 52;
const MAX_FONT_SIZE_PX = 172;

function OpeningCountdownHeroText({ text }: { text: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLSpanElement | null>(null);
  const [fontSize, setFontSize] = useState(MAX_FONT_SIZE_PX);

  useEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) {
      return;
    }

    let resizeObserver: ResizeObserver | null = null;
    const fitText = () => {
      const nextWidth = Math.max(container.clientWidth - 24, 220);
      const nextHeight = Math.max(container.clientHeight - 16, 96);
      let nextFontSize = MAX_FONT_SIZE_PX;
      let letterSpacing = Math.max(1, Math.min(2, nextFontSize * 0.015));

      measure.style.fontSize = `${nextFontSize}px`;
      measure.style.letterSpacing = `${letterSpacing}px`;

      const widthScale = nextWidth / Math.max(measure.scrollWidth, 1);
      const heightScale = nextHeight / Math.max(measure.scrollHeight, 1);
      nextFontSize = Math.max(
        MIN_FONT_SIZE_PX,
        Math.min(MAX_FONT_SIZE_PX, nextFontSize * Math.min(widthScale, heightScale, 1)),
      );
      letterSpacing = Math.max(0.75, Math.min(2, nextFontSize * 0.015));
      measure.style.fontSize = `${nextFontSize}px`;
      measure.style.letterSpacing = `${letterSpacing}px`;

      const finalWidth = measure.scrollWidth;
      if (finalWidth > nextWidth && finalWidth > 0) {
        nextFontSize = Math.max(MIN_FONT_SIZE_PX, nextFontSize * (nextWidth / finalWidth));
      }

      setFontSize(nextFontSize);
    };

    fitText();
    resizeObserver = new ResizeObserver(fitText);
    resizeObserver.observe(container);

    return () => {
      resizeObserver?.disconnect();
    };
  }, [text]);

  return (
    <div ref={containerRef} className="relative h-[9rem] w-full max-w-5xl text-center sm:h-[12rem]">
      <span
        ref={measureRef}
        className="pointer-events-none absolute left-0 top-0 whitespace-nowrap font-black uppercase leading-none tracking-[0.03em] opacity-0"
        style={{
          fontFamily: OPENING_COUNTDOWN_FONT_FAMILY,
          fontVariantNumeric: "tabular-nums",
          fontFeatureSettings: '"tnum" 1',
        }}
      >
        {text}
      </span>
      <div
        className="flex h-full items-center justify-center overflow-hidden font-black uppercase leading-none tracking-[0.03em] text-foreground tabular-nums"
        style={{
          fontSize,
          fontFamily: OPENING_COUNTDOWN_FONT_FAMILY,
          fontVariantNumeric: "tabular-nums",
          fontFeatureSettings: '"tnum" 1',
        }}
      >
        {text}
      </div>
    </div>
  );
}

export function GameOpeningCountdown({
  opensAt,
  timeZone,
  onReady,
  isTransitioning,
  loadingMessage,
}: {
  opensAt: Date;
  timeZone: string | null;
  onReady: () => void;
  isTransitioning: boolean;
  loadingMessage: string;
}) {
  const [remainingMs, setRemainingMs] = useState(() => Math.max(0, opensAt.getTime() - Date.now()));
  const isReady = remainingMs <= 0;

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setRemainingMs(Math.max(0, opensAt.getTime() - Date.now()));
    }, 250);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [opensAt]);

  const countdownParts = getCountdownParts(remainingMs);
  const openAtLabel = formatOpenAt(opensAt, timeZone);
  const heroCountdown = formatOpeningHeroCountdown(remainingMs);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,hsla(var(--foreground)/0.1),transparent_52%),radial-gradient(circle_at_bottom,hsla(var(--foreground)/0.06),transparent_42%)]" />
      <div className="relative z-10 flex w-full max-w-6xl flex-col items-center gap-5 text-center">
        <p className="text-[0.65rem] font-medium uppercase tracking-[0.45em] text-muted-foreground">
          Access Window
        </p>
        <p className="text-sm text-muted-foreground sm:text-base">
          Game opens soon
        </p>
        {isReady ? (
          <OpeningCountdownSnapText text={heroCountdown} onComplete={onReady} />
        ) : (
          <OpeningCountdownHeroText text={heroCountdown} />
        )}
        {isTransitioning ? (
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            <span>{loadingMessage}</span>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[0.7rem] uppercase tracking-[0.32em] text-muted-foreground">
          {countdownParts.map((part) => (
            <span key={part.label}>
              {part.label} {part.value}
            </span>
          ))}
        </div>
        <div className="space-y-1 text-center text-sm text-muted-foreground">
          <p>{openAtLabel}</p>
          {timeZone ? <p className="text-xs uppercase tracking-[0.22em]">{timeZone}</p> : null}
        </div>
      </div>
    </div>
  );
}
