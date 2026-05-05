/**
 * Shared image utility types and helpers used by the step preview renderer
 * and the step accuracy comparison engine.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * /api/drawboard/render returns a retina PNG in dataUrl but the logical-size RGBA buffer
 * in pixelBufferBase64 (same downscale as server-side scoring). Comparing via dataUrl
 * re-downscales in the browser and can disagree with iframe pixel diff + step truth.
 */
export type DrawboardRenderPreviewPayload = {
  dataUrl: string;
  pixelBufferBase64: string;
  width: number;
  height: number;
};

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

export function parseDrawboardRenderPreview(json: unknown): DrawboardRenderPreviewPayload | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  const pixelBufferBase64 = typeof o.pixelBufferBase64 === "string" ? o.pixelBufferBase64 : "";
  const dataUrl = typeof o.dataUrl === "string" ? o.dataUrl : "";
  const width = typeof o.width === "number" ? o.width : 0;
  const height = typeof o.height === "number" ? o.height : 0;
  if (!pixelBufferBase64 || width < 1 || height < 1) return null;
  return { pixelBufferBase64, dataUrl, width, height };
}

export function imageDataFromScoringRgba(
  base64: string,
  width: number,
  height: number,
): ImageData | null {
  try {
    const binary = atob(base64);
    const expected = width * height * 4;
    if (binary.length !== expected) return null;
    const bytes = new Uint8Array(expected);
    for (let i = 0; i < expected; i++) bytes[i] = binary.charCodeAt(i);
    return new ImageData(new Uint8ClampedArray(bytes.buffer), width, height);
  } catch {
    return null;
  }
}
