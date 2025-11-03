/**
 * @description Load an image from a base64 url and return the image element
 * @param base64Url  - The base64 url of the image
 * @returns  - The image element
 */
function loadImage(base64Url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = base64Url;
  });
}

export default loadImage;
