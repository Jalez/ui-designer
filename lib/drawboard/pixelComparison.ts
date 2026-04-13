/**
 * Shared pixel comparison utilities.
 *
 * Used by ScenarioUpdater (baseline comparison), LevelUpdater (URL → ImageData),
 * and the event sequence accuracy engine.
 */

// ---------------------------------------------------------------------------
// loadImageData — URL → ImageData at specified logical dimensions
// ---------------------------------------------------------------------------

export async function loadImageData(
  url: string,
  width: number,
  height: number,
): Promise<ImageData | null> {
  const image = new window.Image();
  image.crossOrigin = "anonymous";
  image.src = url;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error(`Failed to load image: ${url.slice(0, 40)}`));
  });
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

// ---------------------------------------------------------------------------
// runPixelComparison — compare two ImageData via Web Worker
// ---------------------------------------------------------------------------

export type PixelComparisonResult = {
  accuracy: number;
  /** Base64-encoded diff image, or null if comparison failed. */
  diff: string | null;
};

export async function runPixelComparison(
  drawing: ImageData,
  solution: ImageData,
): Promise<PixelComparisonResult> {
  const worker = new Worker(
    new URL("../utils/workers/imageComparisonWorker.ts", import.meta.url),
    { type: "module" },
  );
  try {
    return await new Promise<PixelComparisonResult>((resolve, reject) => {
      worker.onmessage = ({ data }) => {
        resolve({
          accuracy: data.accuracy as number,
          diff: (data.diff as string) ?? null,
        });
      };
      worker.onerror = reject;
      const drawingBuffer = drawing.data.buffer.slice(0);
      const solutionBuffer = solution.data.buffer.slice(0);
      worker.postMessage(
        {
          drawingBuffer,
          solutionBuffer,
          width: drawing.width,
          height: drawing.height,
        },
        [drawingBuffer, solutionBuffer],
      );
    });
  } finally {
    worker.terminate();
  }
}
