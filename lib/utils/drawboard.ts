export const getPixelData = (img = new Image()) => {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx?.drawImage(img, 0, 0);
  const imgData = ctx?.getImageData(0, 0, img.width, img.height);
  return imgData;
};

export function loadImage(base64Url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = base64Url;
  });
}

export const sendToParent = (
  dataURL: string,
  urlName: string,
  scenarioId: string,
  message?: string | 'data'
) => {
  if (typeof window !== 'undefined' && window.parent) {
    window.parent.postMessage({ dataURL, urlName, scenarioId, message }, '*');
  }
};

export const setStyles = (css: string) => {
  if (typeof document !== 'undefined') {
    let style = document.querySelector('style') as HTMLStyleElement;
    if (!style) {
      style = document.createElement('style');
      document.head.appendChild(style);
    }
    style.innerHTML = css || '';
  }
};

