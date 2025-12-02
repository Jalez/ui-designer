'use client';

import { useEffect, useState } from 'react';
import { domToPng } from 'modern-screenshot';
import { ErrorFallback } from '@/components/drawboard/ErrorFallback';
import { getPixelData, sendToParent, setStyles } from '@/lib/utils/drawboard';

type errorObj = {
  message: string;
  lineno?: number;
  colno?: number;
};

export default function DrawBoardPage() {
  const [html, setHtml] = useState<React.ReactElement | null>(null);
  const [css, setCss] = useState<string>();
  const [stylesCorrect, setStylesCorrect] = useState<boolean>(false);
  const [jsCorrect, setJsCorrect] = useState<boolean>(false);
  const [js, setJs] = useState<string>();
  const [error, setError] = useState<null | errorObj>(null);
  const [imgUrl, setImgUrl] = useState<string>();
  const [interactive, setInteractive] = useState<boolean>(false);

  // Get URL parameters
  const urlName =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('name') || ''
      : '';
  const scenarioId =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('scenarioId') || ''
      : '';

  useEffect(() => {
    if (typeof window !== 'undefined') {
      console.log("DrawBoard: Sending mounted message", { urlName, scenarioId });
      window.parent.postMessage('mounted', '*');
    }
  }, [urlName, scenarioId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePostMessage = (event: MessageEvent) => {
      console.log("DrawBoard: Received message", { urlName, eventName: event.data.name, message: event.data?.message });
      if (urlName !== event.data.name) {
        console.log("DrawBoard: Message name mismatch, ignoring", { urlName, eventName: event.data.name });
        return;
      }

      if (event.data?.message === 'reload') {
        console.log("DrawBoard: Reloading");
        window.location.reload();
        return;
      }

      if (event.data.html) {
        setHtml(
          <kbd dangerouslySetInnerHTML={{ __html: event.data.html }} />
        );
      }

      if (event.data.css) {
        console.log("DrawBoard: Received CSS", { urlName, cssLength: event.data.css.length });
        setCss(event.data.css);
        setStylesCorrect(false);
      }

      if (event.data.interactive !== undefined) {
        console.log("DrawBoard: Setting interactive", { urlName, interactive: event.data.interactive });
        setInteractive(event.data.interactive);
      }

      if (event.data.events) {
        const events = JSON.parse(event.data.events);
        events.forEach((eventType: string) => {
          document.body.addEventListener(eventType, (e) => {
            const board = document.getElementById('root') as HTMLElement;
            if (!board) return;

            domToPng(board).then((dataURL: string) => {
              const img = new Image();
              img.src = dataURL;
              img.onload = () => {
                const imgData = getPixelData(img);
                if (!imgData) {
                  console.warn("DrawBoard: Failed to get pixel data");
                  return;
                }
                // ImageData can't be sent directly, so we send the ArrayBuffer and metadata
                const pixelBuffer = imgData.data.buffer.slice(0);
                console.log("DrawBoard: Sending pixels", { urlName, scenarioId, width: imgData.width, height: imgData.height, bufferSize: pixelBuffer.byteLength });
                window.parent.postMessage({
                  message: 'pixels',
                  dataURL: pixelBuffer,
                  urlName,
                  scenarioId,
                  width: imgData.width,
                  height: imgData.height,
                }, '*', [pixelBuffer]);
                if (urlName === 'solutionUrl') {
                  sendToParent(dataURL, urlName, scenarioId, 'data');
                  return;
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

    window.addEventListener('message', handlePostMessage);
    return () => {
      window.removeEventListener('message', handlePostMessage);
    };
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

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
      document.querySelectorAll('script').forEach((script) => {
        script.remove();
      });

      const blob = new Blob([`{ ${js} \n }`], { type: 'text/javascript' });
      const scriptURL = URL.createObjectURL(blob);

      const script = document.createElement('script');
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
        console.log("DrawBoard: Styles set, setting stylesCorrect=true", { urlName });
        setStylesCorrect(true);
      } catch (error) {
        console.error("DrawBoard: Error setting styles", error);
        setStylesCorrect(false);
      }
    }
  }, [css, urlName]);

  useEffect(() => {
    // Use setTimeout to ensure DOM is rendered
    const timeout = setTimeout(() => {
      const board = document.getElementById('root');
      console.log("DrawBoard: Checking if ready to capture", { urlName, stylesCorrect, jsCorrect, hasBoard: !!board });
      if (stylesCorrect && jsCorrect && board) {
        console.log("DrawBoard: Ready! Capturing screenshot", { urlName });
        domToPng(board).then((dataURL: string) => {
          const img = new Image();
          img.src = dataURL;
          img.onload = () => {
            const imgData = getPixelData(img);
            if (!imgData) {
              console.warn("DrawBoard: Failed to get pixel data");
              return;
            }
            // ImageData can't be sent directly, so we send the ArrayBuffer and metadata
            const pixelBuffer = imgData.data.buffer.slice(0);
            console.log("DrawBoard: Sending pixels", { urlName, scenarioId, width: imgData.width, height: imgData.height, bufferSize: pixelBuffer.byteLength });
            window.parent.postMessage({
              message: 'pixels',
              dataURL: pixelBuffer,
              urlName,
              scenarioId,
              width: imgData.width,
              height: imgData.height,
            }, '*', [pixelBuffer]);
            setImgUrl(dataURL);
            if (urlName === 'solutionUrl') {
              console.log("DrawBoard: Sending solution URL data", { urlName, scenarioId });
              sendToParent(dataURL, urlName, scenarioId, 'data');
              return;
            }
          };
        }).catch((error) => {
          console.error("DrawBoard: Error capturing screenshot", error);
        });
      }
    }, 100); // Small delay to ensure DOM is ready
    
    return () => clearTimeout(timeout);
  }, [stylesCorrect, jsCorrect, urlName, scenarioId, html]);

  if (error) {
    return (
      <div id="root" style={{ width: '100%', height: '100%' }}>
        <ErrorFallback error={error} />
      </div>
    );
  }

  if (imgUrl && !interactive) {
    return (
      <div id="root" style={{ width: '100%', height: '100%' }}>
        <img src={imgUrl} alt="screenshot" />
      </div>
    );
  }

  return (
    <div id="root" style={{ width: '100%', height: '100%', minHeight: '100vh' }}>
      {html}
    </div>
  );
}

