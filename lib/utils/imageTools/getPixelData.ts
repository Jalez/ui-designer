export const getPixelData = (
  img = new Image(),
  width: number,
  height: number
) => {
  const canvas = document.createElement("canvas");
  // Set the width and height of the canvas to the width and height that are passed in
  canvas.width = width;
  canvas.height = height;
  // Get the 2D context of the canvas
  const ctx = canvas.getContext("2d");
  // Draw the image on the canvas
  ctx?.drawImage(img, 0, 0);
  // Get the image data from the canvas
  const imgData = ctx?.getImageData(0, 0, width, height) as ImageData;
  // Resolve the promise with the image data
  return imgData;
};
