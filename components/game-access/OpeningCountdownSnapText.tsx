'use client';

import { useEffect, useRef } from "react";
import {
  createSnapDissolveFilter,
  startSvgTextSnapEffect,
} from "@/components/CSSWordCloud/WordCloud/snapEffect";

export const OPENING_SNAP_REDIRECT_DELAY_MS = 3200;
export const OPENING_COUNTDOWN_FONT_FAMILY = '"SFMono-Regular", "SF Mono", ui-monospace, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

const MIN_FONT_SIZE_PX = 52;
const MAX_FONT_SIZE_PX = 172;

function fitSvgCountdownText(options: {
  textNode: SVGTextElement;
  containerWidth: number;
  containerHeight: number;
  text: string;
}) {
  const { textNode, containerWidth, containerHeight, text } = options;
  const maxWidth = Math.max(containerWidth - 32, 220);
  const maxHeight = Math.max(containerHeight - 24, 120);
  let fontSize = MAX_FONT_SIZE_PX;
  let letterSpacing = Math.max(1, Math.min(2, fontSize * 0.015));

  textNode.style.fontSize = `${fontSize}px`;
  textNode.style.letterSpacing = `${letterSpacing}px`;

  const initialBox = textNode.getBBox();
  if (initialBox.width > 0 && initialBox.height > 0) {
    const scale = Math.min(maxWidth / initialBox.width, maxHeight / initialBox.height, 1);
    fontSize = Math.max(MIN_FONT_SIZE_PX, Math.min(MAX_FONT_SIZE_PX, fontSize * scale));
    letterSpacing = Math.max(0.75, Math.min(2, fontSize * 0.015));
    textNode.style.fontSize = `${fontSize}px`;
    textNode.style.letterSpacing = `${letterSpacing}px`;
  }

  const renderedWidth =
    textNode.getComputedTextLength() + Math.max(text.length - 1, 0) * letterSpacing;
  if (renderedWidth > maxWidth && renderedWidth > 0) {
    const shrinkScale = maxWidth / renderedWidth;
    fontSize = Math.max(MIN_FONT_SIZE_PX, fontSize * shrinkScale);
    letterSpacing = Math.max(0.75, Math.min(2, fontSize * 0.015));
    textNode.style.fontSize = `${fontSize}px`;
    textNode.style.letterSpacing = `${letterSpacing}px`;
  }
}

export function OpeningCountdownSnapText({
  text,
  onComplete,
}: {
  text: string;
  onComplete: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    let resizeObserver: ResizeObserver | null = null;
    const timeoutIds: number[] = [];
    let unmounted = false;
    let snapCleanup: (() => void) | null = null;

    const renderSnap = () => {
      container.replaceChildren();
      snapCleanup?.();
      snapCleanup = null;

      const width = Math.max(container.clientWidth || 0, 320);
      const height = Math.max(container.clientHeight || 0, 220);
      const computedColor = window.getComputedStyle(container).color || "#111";
      const svgNs = "http://www.w3.org/2000/svg";
      const createSvgElement = <T extends SVGElement>(tag: string) => (
        document.createElementNS(svgNs, tag) as T
      );

      const svg = createSvgElement<SVGSVGElement>("svg");
      svg.setAttribute("width", String(width));
      svg.setAttribute("height", String(height));
      svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
      svg.setAttribute("aria-hidden", "true");
      svg.style.position = "absolute";
      svg.style.inset = "0";
      svg.style.overflow = "visible";

      const defs = createSvgElement<SVGDefsElement>("defs");
      svg.appendChild(defs);
      const {
        filterId: dissolveFilterId,
        displacementNode: displacement,
        stepFuncNode: dissolveStepFunc,
      } = createSnapDissolveFilter(defs);

      const dissolveGroup = createSvgElement<SVGGElement>("g");
      dissolveGroup.setAttribute("transform", `translate(${width / 2} ${height / 2})`);
      dissolveGroup.setAttribute("filter", `url(#${dissolveFilterId})`);
      svg.appendChild(dissolveGroup);

      const dissolveText = createSvgElement<SVGTextElement>("text");
      dissolveText.setAttribute("x", "0");
      dissolveText.setAttribute("y", "0");
      dissolveText.setAttribute("text-anchor", "middle");
      dissolveText.setAttribute("dominant-baseline", "middle");
      dissolveText.textContent = text;
      dissolveText.style.fontFamily = OPENING_COUNTDOWN_FONT_FAMILY;
      dissolveText.style.fontVariantNumeric = "tabular-nums";
      dissolveText.style.fontFeatureSettings = '"tnum" 1';
      dissolveText.style.fill = computedColor;
      dissolveGroup.appendChild(dissolveText);

      container.appendChild(svg);
      fitSvgCountdownText({
        textNode: dissolveText,
        containerWidth: width,
        containerHeight: height,
        text,
      });

      snapCleanup = startSvgTextSnapEffect({
        svg,
        dissolveTarget: dissolveGroup,
        displacementNode: displacement,
        stepFuncNode: dissolveStepFunc,
        particleColor: computedColor,
        isDarkMode: document.documentElement.classList.contains("dark"),
      });
    };

    renderSnap();
    resizeObserver = new ResizeObserver(() => {
      if (!unmounted) {
        renderSnap();
      }
    });
    resizeObserver.observe(container);

    const completeTimeoutId = window.setTimeout(() => {
      onComplete();
    }, OPENING_SNAP_REDIRECT_DELAY_MS);
    timeoutIds.push(completeTimeoutId);

    return () => {
      unmounted = true;
      snapCleanup?.();
      timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
      resizeObserver?.disconnect();
      container.replaceChildren();
    };
  }, [onComplete, text]);

  return (
    <div
      ref={containerRef}
      className="relative h-[9rem] w-full max-w-5xl text-foreground sm:h-[12rem]"
    />
  );
}
