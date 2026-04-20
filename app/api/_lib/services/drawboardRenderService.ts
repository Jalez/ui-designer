import { chromium, type Browser } from "playwright";
import { PNG } from "pngjs";

const DISPLAY_DEVICE_SCALE_FACTOR = 2;

export interface DrawboardRenderRequest {
  css: string;
  snapshotHtml: string;
  width: number;
  height: number;
  scenarioId: string;
  urlName: string;
  includeDataUrl?: boolean;
}

export interface DrawboardRenderResult {
  scenarioId: string;
  urlName: string;
  width: number;
  height: number;
  pixelBufferBase64: string;
  dataUrl?: string;
}

let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }

  return browserPromise;
}

function buildRenderHtml(snapshotHtml: string, css: string, width: number, height: number): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        width: ${width}px;
        height: ${height}px;
        overflow: hidden;
        background: transparent;
      }

      body {
        position: relative;
      }
    </style>
    <style id="user-styles">${css}</style>
  </head>
  <body>${snapshotHtml}</body>
</html>`;
}

function downscaleRgbaNearest(
  sourceData: Buffer,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): Buffer {
  if (sourceWidth === targetWidth && sourceHeight === targetHeight) {
    return sourceData;
  }

  const target = Buffer.alloc(targetWidth * targetHeight * 4);
  const scaleX = sourceWidth / targetWidth;
  const scaleY = sourceHeight / targetHeight;

  for (let y = 0; y < targetHeight; y += 1) {
    const sourceY = Math.min(sourceHeight - 1, Math.floor(y * scaleY));
    for (let x = 0; x < targetWidth; x += 1) {
      const sourceX = Math.min(sourceWidth - 1, Math.floor(x * scaleX));
      const sourceIndex = (sourceY * sourceWidth + sourceX) * 4;
      const targetIndex = (y * targetWidth + x) * 4;
      target[targetIndex] = sourceData[sourceIndex];
      target[targetIndex + 1] = sourceData[sourceIndex + 1];
      target[targetIndex + 2] = sourceData[sourceIndex + 2];
      target[targetIndex + 3] = sourceData[sourceIndex + 3];
    }
  }

  return target;
}

export async function renderDrawboardScreenshot(
  request: DrawboardRenderRequest,
): Promise<DrawboardRenderResult> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: {
      width: request.width,
      height: request.height,
    },
    deviceScaleFactor: DISPLAY_DEVICE_SCALE_FACTOR,
  });

  try {
    const page = await context.newPage();
    await page.setContent(
      buildRenderHtml(request.snapshotHtml, request.css, request.width, request.height),
      { waitUntil: "load" },
    );
    await page.evaluate(async () => {
      const fonts = document.fonts;
      if (fonts?.ready) {
        await fonts.ready;
      }
    });
    await page.waitForTimeout(50);

    const body = page.locator("body");
    const screenshotBuffer = await body.screenshot({
      type: "png",
      omitBackground: true,
    });
    const png = PNG.sync.read(screenshotBuffer);
    const scoringPixels = downscaleRgbaNearest(
      png.data,
      png.width,
      png.height,
      request.width,
      request.height,
    );

    return {
      scenarioId: request.scenarioId,
      urlName: request.urlName,
      width: request.width,
      height: request.height,
      pixelBufferBase64: Buffer.from(scoringPixels).toString("base64"),
      ...(request.includeDataUrl
        ? { dataUrl: `data:image/png;base64,${screenshotBuffer.toString("base64")}` }
        : {}),
    };
  } finally {
    await context.close();
  }
}
