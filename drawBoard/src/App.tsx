/** @format */
import { ReactElement, useEffect, useState } from "react";
import { domToPng } from "modern-screenshot";
import { errorObj } from "./types";
import { ErrorFallback } from "./ErrorFallback";
import { getPixelData, sendToParent, setStyles } from "./utils";

const params = new URLSearchParams(window.location.search);
const urlName = params.get("name") || "";
const scenarioId = params.get("scenarioId") || "";
const scenarioWidth = parseInt(params.get("width") || "0", 10);
const scenarioHeight = parseInt(params.get("height") || "0", 10);


function App() {
  const [html, setHtml] = useState<ReactElement>();
  const [css, setCss] = useState<string>();
  const [stylesCorrect, setStylesCorrect] = useState<Boolean>(false);
  const [jsCorrect, setJsCorrect] = useState<Boolean>(false);
  const [js, setJs] = useState<string>();
  const [error, setError] = useState<null | errorObj>();
  const [imgUrl, setImgUrl] = useState<string>();
  const [interactive, setInteractive] = useState<Boolean>(false);
  const [dataReceived, setDataReceived] = useState(false);

  // Keep sending "mounted" until the parent responds with data
  useEffect(() => {
    if (dataReceived) return;
    window.parent.postMessage("mounted", "*");
    const interval = setInterval(() => {
      window.parent.postMessage("mounted", "*");
    }, 200);
    return () => clearInterval(interval);
  }, [dataReceived]);

  useEffect(() => {
    const handlePostMessage = (event: MessageEvent) => {
      if (urlName !== event.data.name) return;
      if (event.data?.message === "reload") {
        window.location.reload();
        return;
      }
      // Data received from parent - stop sending "mounted"
      setDataReceived(true);
      if (event.data.html) {
        setHtml(<kbd dangerouslySetInnerHTML={{ __html: event.data.html }} />);
      }
      if (event.data.css) {
        setCss(event.data.css);
        setStylesCorrect(false);
      } else {
        // No CSS to apply - styles are trivially correct
        setStylesCorrect(true);
      }
      setInteractive(event.data.interactive);

      if (event.data.events) {
        const events = JSON.parse(event.data.events);
        events.forEach((evt: string) => {
          document.body.addEventListener(evt, () => {
            const board = document.getElementById("root") as HTMLElement;
            if (!board) return;
            domToPng(board).then((dataURL: string) => {
              const img = new Image();
              img.src = dataURL;
              img.onload = () => {
                const imgData = getPixelData(img);
                sendToParent(
                  imgData as unknown as string,
                  urlName,
                  scenarioId,
                  "pixels"
                );
                if (urlName === "solutionUrl") {
                  sendToParent(dataURL, urlName, scenarioId, "data");
                }
              };
            });
          });
        });
      }

      if (event.data.js && event.data.js.trim()) {
        setJs(event.data.js);
        setJsCorrect(false);
      } else {
        setJsCorrect(true);
      }
    };

    window.addEventListener("message", handlePostMessage);
    return () => {
      window.removeEventListener("message", handlePostMessage);
    };
  });

  useEffect(() => {
    const handleGlobalError = (
      message: string | Event,
      source?: string,
      lineno?: number,
      colno?: number,
      error?: Error
    ): boolean => {
      setError({
        message: message.toString(),
        lineno: lineno || 0,
        colno: colno || 0,
      });
      return true;
    };
    window.onerror = handleGlobalError;

    if (js && !jsCorrect && stylesCorrect) {
      document.querySelectorAll("script").forEach((script) => {
        script.remove();
      });

      const blob = new Blob([`{ ${js} \n }`], { type: "text/javascript" });
      const scriptURL = URL.createObjectURL(blob);

      const script = document.createElement("script");
      script.src = scriptURL;
      script.onload = () => {
        setJsCorrect(true);
        URL.revokeObjectURL(scriptURL);
      };
      document.body.appendChild(script);
    }

    return () => {
      window.onerror = null;
    };
  }, [js, jsCorrect, stylesCorrect]);

  useEffect(() => {
    if (css) {
      try {
        setStyles(css);
        setStylesCorrect(true);
      } catch (error) {
        setStylesCorrect(false);
      }
    }
  }, [css]);

  useEffect(() => {
    const board = document.getElementById("root");
    if (stylesCorrect && jsCorrect && board) {
      domToPng(board).then((dataURL: string) => {
        const img = new Image();
        img.src = dataURL;
        img.onload = () => {
          const imgData = getPixelData(img);
          sendToParent(
            imgData as unknown as string,
            urlName,
            scenarioId,
            "pixels"
          );
          setImgUrl(dataURL);
          if (urlName === "solutionUrl") {
            sendToParent(dataURL, urlName, scenarioId, "data");
          }
        };
      });
    }
  }, [stylesCorrect, jsCorrect]);

  return (
    <>
      {error ? (
        <ErrorFallback error={error} />
      ) : imgUrl && !interactive ? (
        <img src={imgUrl} alt="screenshot" />
      ) : (
        html
      )}
    </>
  );
}

export default App;
