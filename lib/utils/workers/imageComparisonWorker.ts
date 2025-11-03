import Pixelmatch from "pixelmatch";
import { Buffer } from "buffer";

addEventListener("message", ({ data }) => {
  const { drawingBuffer, solutionBuffer, width, height } = data;

  const solutionData = new Uint8ClampedArray(solutionBuffer);
  const drawingData = new Uint8ClampedArray(drawingBuffer);
  const diff = Buffer.alloc(solutionBuffer.byteLength);

  const numDiffPixels = Pixelmatch(
    solutionData,
    drawingData,
    diff,
    width,
    height,
    { threshold: 0 }
  );

  const percentage = 100 - (numDiffPixels / (width * height)) * 100;

  postMessage({
    accuracy: percentage,
    diff: diff.toString("base64"),
  });
});
