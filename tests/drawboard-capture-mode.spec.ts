import { expect, test } from "@playwright/test";

const DRAWBOARD_URL = process.env.PLAYWRIGHT_DRAWBOARD_URL || "http://127.0.0.1:3500";

test("server-side Playwright renderer returns pixels and a preview image", async ({ request }) => {
  const response = await request.post("/api/drawboard/render", {
    data: {
      css: `
        body { margin: 0; }
        .swatch { width: 80px; height: 60px; background: rgb(37, 99, 235); }
      `,
      snapshotHtml: `<main class="swatch"></main>`,
      width: 80,
      height: 60,
      scenarioId: "capture-mode-api",
      urlName: "drawingUrl",
      includeDataUrl: true,
    },
  });

  expect(response.ok()).toBe(true);
  const payload = await response.json();
  expect(payload).toMatchObject({
    scenarioId: "capture-mode-api",
    urlName: "drawingUrl",
    width: 80,
    height: 60,
  });
  expect(payload.pixelBufferBase64).toEqual(expect.any(String));
  expect(Buffer.from(payload.pixelBufferBase64, "base64")).toHaveLength(80 * 60 * 4);
  expect(payload.dataUrl).toEqual(expect.stringMatching(/^data:image\/png;base64,/));
});

test.describe("drawboard capture modes", () => {
  for (const mode of ["browser", "playwright"] as const) {
    test(`${mode} mode can produce a picture through the drawboard protocol`, async ({ page }) => {
      await page.goto("/help", { waitUntil: "networkidle" });
      await page.setContent("<!doctype html><html><body></body></html>");

      const result = await page.evaluate(
        async ({ drawboardUrl, captureMode }) => {
          const scenarioId = `capture-mode-${captureMode}`;
          const urlName = "drawingUrl";
          const params = new URLSearchParams({
            name: urlName,
            scenarioId,
            width: "96",
            height: "72",
            captureMode,
          });

          const iframe = document.createElement("iframe");

          return await new Promise<{
            dataUrl: string;
            mode: string;
            protocolMessage: string;
            pixelBufferLength?: number;
          }>((resolve, reject) => {
            let sentPayload = false;
            const timeout = window.setTimeout(() => {
              window.removeEventListener("message", handleMessage);
              reject(new Error(`Timed out waiting for ${captureMode} capture`));
            }, 20_000);

            async function handleMessage(event: MessageEvent) {
              if (event.source !== iframe.contentWindow) {
                return;
              }
              if (event.data?.scenarioId !== scenarioId) {
                return;
              }

              if (event.data?.message === "mounted" && !sentPayload) {
                sentPayload = true;
                iframe.contentWindow?.postMessage(
                  {
                    html: `<main class="swatch">Capture ${captureMode}</main>`,
                    css: `
                      body { margin: 0; font-family: Arial, sans-serif; }
                      .swatch {
                        box-sizing: border-box;
                        width: 96px;
                        height: 72px;
                        padding: 8px;
                        color: white;
                        background: ${captureMode === "browser" ? "#2563eb" : "#16a34a"};
                      }
                    `,
                    js: "",
                    events: "[]",
                    scenarioId,
                    name: urlName,
                    interactive: false,
                    isCreator: true,
                    autoCapture: true,
                    recordingSequence: false,
                    replaySequence: [],
                    replayRefreshNonce: 0,
                  },
                  "*",
                );
                return;
              }

              if (captureMode === "browser" && event.data?.message === "data") {
                window.clearTimeout(timeout);
                window.removeEventListener("message", handleMessage);
                resolve({
                  dataUrl: event.data.dataURL,
                  mode: captureMode,
                  protocolMessage: "data",
                });
                return;
              }

              if (captureMode === "playwright" && event.data?.message === "render-ready") {
                try {
                  const response = await fetch("/api/drawboard/render", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      css: event.data.css,
                      snapshotHtml: event.data.snapshotHtml,
                      width: 96,
                      height: 72,
                      scenarioId,
                      urlName,
                      includeDataUrl: true,
                    }),
                  });
                  const payload = await response.json();
                  if (!response.ok) {
                    throw new Error(payload?.error || `Render failed with ${response.status}`);
                  }
                  window.clearTimeout(timeout);
                  window.removeEventListener("message", handleMessage);
                  resolve({
                    dataUrl: payload.dataUrl,
                    mode: captureMode,
                    protocolMessage: "render-ready",
                    pixelBufferLength: atob(payload.pixelBufferBase64).length,
                  });
                } catch (error) {
                  window.clearTimeout(timeout);
                  window.removeEventListener("message", handleMessage);
                  reject(error);
                }
              }
            }

            window.addEventListener("message", handleMessage);
            iframe.src = `${drawboardUrl}/?${params.toString()}`;
            document.body.appendChild(iframe);
          });
        },
        { drawboardUrl: DRAWBOARD_URL, captureMode: mode },
      );

      expect(result.mode).toBe(mode);
      expect(result.dataUrl).toEqual(expect.stringMatching(/^data:image\/png;base64,/));
      if (mode === "browser") {
        expect(result.protocolMessage).toBe("data");
      } else {
        expect(result.protocolMessage).toBe("render-ready");
        expect(result.pixelBufferLength).toBe(96 * 72 * 4);
      }
    });
  }
});
