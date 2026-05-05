export const getPixelData = (
  img = new Image(),
  targetWidth?: number,
  targetHeight?: number
) => {
  const canvas = document.createElement("canvas");
  const width = targetWidth || img.width;
  const height = targetHeight || img.height;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    // Keep comparisons stable when capture is downsampled to scenario size.
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, width, height);
  }
  const imgData = ctx?.getImageData(0, 0, width, height);
  // Release GPU surface immediately (critical for Firefox)
  canvas.width = 0;
  canvas.height = 0;
  return imgData;
};

export type InteractionEventType = "click" | "change" | "input" | "submit" | "keydown";

export type InteractionTrigger = {
  id: string;
  eventType: InteractionEventType;
  selector?: string;
  keyFilter?: string;
  label?: string;
};

export type VerifiedInteraction = {
  id: string;
  triggerId: string;
  eventType: InteractionEventType;
  label?: string;
  selector?: string;
  targetSummary?: string;
  keyFilter?: string;
  keyPressed?: string;
  sequence: number;
  createdAt: string;
  preHash: string;
  postHash: string;
  verificationSource: "dom" | "pixel";
};

export type DrawboardSnapshotPayload = {
  css: string;
  snapshotHtml: string;
  width: number;
  height: number;
};

export type EventSequenceStep = {
  id: string;
  scenarioId: string;
  order: number;
  eventType: InteractionEventType;
  showInTimeline?: boolean;
  selector?: string;
  keyFilter?: string;
  instruction: string;
  targetSummary?: string;
  verificationSource: "dom" | "pixel";
  preHash: string;
  postHash: string;
  snapshot: DrawboardSnapshotPayload;
};

export function loadImage(base64Url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = base64Url;
  });
}

const SUPPORTED_EVENT_TYPES: InteractionEventType[] = ["click", "change", "input", "submit", "keydown"];

const stableTrim = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

export function normalizeInteractionTriggers(rawEvents: string | string[] | unknown): InteractionTrigger[] {
  let parsed: unknown = rawEvents;
  if (typeof rawEvents === "string") {
    try {
      parsed = JSON.parse(rawEvents);
    } catch {
      parsed = [rawEvents];
    }
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  const seenIds = new Set<string>();
  return parsed.flatMap((entry, index) => {
    let next: InteractionTrigger | null = null;

    if (typeof entry === "string") {
      const eventType = entry.trim() as InteractionEventType;
      if (!SUPPORTED_EVENT_TYPES.includes(eventType)) {
        return [];
      }
      next = {
        id: `legacy-${eventType}-${index}`,
        eventType,
        label: eventType,
      };
    } else if (entry && typeof entry === "object") {
      const candidate = entry as Partial<InteractionTrigger>;
      const eventType = candidate.eventType?.trim() as InteractionEventType | undefined;
      if (!eventType || !SUPPORTED_EVENT_TYPES.includes(eventType)) {
        return [];
      }
      next = {
        id: stableTrim(candidate.id) || `trigger-${eventType}-${index}`,
        eventType,
        selector: stableTrim(candidate.selector),
        keyFilter: stableTrim(candidate.keyFilter),
        label: stableTrim(candidate.label) || eventType,
      };
    }

    if (!next) {
      return [];
    }

    let id = next.id;
    let suffix = 1;
    while (seenIds.has(id)) {
      suffix += 1;
      id = `${next.id}-${suffix}`;
    }
    seenIds.add(id);
    return [{ ...next, id }];
  });
}

export function normalizeSnapshotMarkup(snapshotHtml: string): string {
  return snapshotHtml
    .replace(/\sdata-drawboard-ui="[^"]*"/g, "")
    .replace(/\sdata-interactive="[^"]*"/g, "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function hashString(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function hashDrawboardSnapshot(css: string, snapshotHtml: string): string {
  return hashString(`${css}\u0000${normalizeSnapshotMarkup(snapshotHtml)}`);
}

export function summarizeEventTarget(target: EventTarget | null): string | undefined {
  if (!(target instanceof Element)) {
    return undefined;
  }

  const parts = [target.tagName.toLowerCase()];
  if (target.id) {
    parts.push(`#${target.id}`);
  }
  const classes = Array.from(target.classList).slice(0, 2);
  classes.forEach((cls) => parts.push(`.${cls}`));
  return parts.join("");
}

export function selectorFromEventTarget(target: EventTarget | null): string | undefined {
  if (!(target instanceof Element)) {
    return undefined;
  }

  if (target.id) {
    return `#${target.id}`;
  }

  const classNames = Array.from(target.classList)
    .filter(Boolean)
    .slice(0, 2);
  const tagName = target.tagName.toLowerCase();
  if (classNames.length > 0) {
    return `${tagName}${classNames.map((className) => `.${className}`).join("")}`;
  }

  return tagName;
}

export function buildDraftEventStepCopy(
  eventType: InteractionEventType,
  targetSummary?: string,
): { label: string; instruction: string } {
  const targetLabel = targetSummary?.replace(/\s+/g, " ").trim() || "target";
  const action = eventType === "input"
    ? "Update"
    : eventType === "change"
      ? "Change"
      : eventType === "submit"
        ? "Submit"
        : eventType === "keydown"
          ? "Press key on"
          : "Click";

  return {
    label: `${action} ${targetLabel}`,
    instruction: `${action} ${targetLabel}`,
  };
}

export function computePixelSignature(imageData: ImageData): string {
  const data = imageData.data;
  let hash = 0;
  const stride = Math.max(16, Math.floor(data.length / 512));
  for (let index = 0; index < data.length; index += stride) {
    const r = data[index] ?? 0;
    const g = data[index + 1] ?? 0;
    const b = data[index + 2] ?? 0;
    const a = data[index + 3] ?? 0;
    hash = Math.imul(hash ^ ((r << 24) ^ (g << 16) ^ (b << 8) ^ a), 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export const sendToParent = (
  dataURL: string,
  urlName: string,
  scenarioId: string,
  message?: string | "data"
) => {
  window.parent.postMessage({ dataURL, urlName, scenarioId, message }, "*");
};

const syncFormControlState = (sourceRoot: HTMLElement, snapshotRoot: HTMLElement) => {
  const sourceInputs = sourceRoot.querySelectorAll("input");
  const snapshotInputs = snapshotRoot.querySelectorAll("input");
  sourceInputs.forEach((sourceInput, index) => {
    const snapshotInput = snapshotInputs[index];
    if (!snapshotInput) {
      return;
    }

    const inputType = sourceInput.type;
    if (inputType === "checkbox" || inputType === "radio") {
      if (sourceInput.checked) {
        snapshotInput.setAttribute("checked", "");
      } else {
        snapshotInput.removeAttribute("checked");
      }
      return;
    }

    snapshotInput.setAttribute("value", sourceInput.value);
  });

  const sourceTextareas = sourceRoot.querySelectorAll("textarea");
  const snapshotTextareas = snapshotRoot.querySelectorAll("textarea");
  sourceTextareas.forEach((sourceTextarea, index) => {
    const snapshotTextarea = snapshotTextareas[index];
    if (!snapshotTextarea) {
      return;
    }
    snapshotTextarea.textContent = sourceTextarea.value;
  });

  const sourceSelects = sourceRoot.querySelectorAll("select");
  const snapshotSelects = snapshotRoot.querySelectorAll("select");
  sourceSelects.forEach((sourceSelect, index) => {
    const snapshotSelect = snapshotSelects[index];
    if (!snapshotSelect) {
      return;
    }

    const sourceOptions = sourceSelect.querySelectorAll("option");
    const snapshotOptions = snapshotSelect.querySelectorAll("option");
    sourceOptions.forEach((sourceOption, optionIndex) => {
      const snapshotOption = snapshotOptions[optionIndex];
      if (!snapshotOption) {
        return;
      }

      if (sourceOption.selected) {
        snapshotOption.setAttribute("selected", "");
      } else {
        snapshotOption.removeAttribute("selected");
      }
    });
  });

  const sourceDetails = sourceRoot.querySelectorAll("details");
  const snapshotDetails = snapshotRoot.querySelectorAll("details");
  sourceDetails.forEach((sourceDetailsElement, index) => {
    const snapshotDetailsElement = snapshotDetails[index];
    if (!snapshotDetailsElement) {
      return;
    }

    if (sourceDetailsElement.open) {
      snapshotDetailsElement.setAttribute("open", "");
    } else {
      snapshotDetailsElement.removeAttribute("open");
    }
  });
};

const replaceCanvasWithImages = (sourceRoot: HTMLElement, snapshotRoot: HTMLElement) => {
  const sourceCanvases = sourceRoot.querySelectorAll("canvas");
  const snapshotCanvases = snapshotRoot.querySelectorAll("canvas");
  sourceCanvases.forEach((sourceCanvas, index) => {
    const snapshotCanvas = snapshotCanvases[index];
    if (!snapshotCanvas) {
      return;
    }

    try {
      const dataUrl = sourceCanvas.toDataURL();
      const image = snapshotCanvas.ownerDocument.createElement("img");
      image.src = dataUrl;
      image.width = sourceCanvas.width;
      image.height = sourceCanvas.height;
      image.style.width = sourceCanvas.style.width || `${sourceCanvas.width}px`;
      image.style.height = sourceCanvas.style.height || `${sourceCanvas.height}px`;
      image.style.display = "block";
      snapshotCanvas.replaceWith(image);
    } catch {
      // Ignore unreadable canvases and keep them as-is.
    }
  });
};

export const createDrawboardSnapshot = () => {
  const style = document.getElementById("user-styles") as HTMLStyleElement | null;
  const snapshotBody = document.body.cloneNode(true);
  if (!(snapshotBody instanceof HTMLBodyElement)) {
    throw new Error("Drawboard body snapshot could not be created");
  }

  snapshotBody.querySelectorAll("script, [data-drawboard-ui]").forEach((element) => {
    element.remove();
  });

  syncFormControlState(document.body, snapshotBody);
  replaceCanvasWithImages(document.body, snapshotBody);

  return {
    css: style?.textContent || "",
    snapshotHtml: snapshotBody.innerHTML,
  };
};

export const createSnapshotPayload = (width: number, height: number): DrawboardSnapshotPayload => {
  const snapshot = createDrawboardSnapshot();
  return {
    ...snapshot,
    width,
    height,
  };
};

export const setStyles = (css: string) => {
  const style = document.getElementById("user-styles") as HTMLStyleElement;
  if (style) {
    style.innerHTML = css || "";
  }
};
