export const getPixelData = (img = new Image()) => {
  const canvas = document.createElement("canvas");
  // Set the width and height of the canvas to the width and height of the image
  canvas.width = img.width;
  canvas.height = img.height;
  // Get the 2D context of the canvas
  const ctx = canvas.getContext("2d");
  // Draw the image on the canvas
  ctx?.drawImage(img, 0, 0);
  // Get the image data from the canvas
  const imgData = ctx?.getImageData(0, 0, img.width, img.height);
  // Resolve the promise with the image data
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
  message?: string | "data"
) => {
  window.parent.postMessage({ dataURL, urlName, scenarioId, message }, "*");
};

export const setStyles = (css: string) => {
  const style = document.getElementById("user-styles") as HTMLStyleElement;
  if (style) {
    style.innerHTML = css || "";
  }
};
