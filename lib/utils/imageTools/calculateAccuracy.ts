import Pixelmatch from "pixelmatch";
import { Buffer } from "buffer";

/**
 *  Calculate the accuracy of the comparison between two images
 * @param drawingData - ImageData object of the students design
 * @param solutionData - ImageData object of the solution design
 * @returns  - The accuracy of the comparison, and the difference between the two images
 */
const calculateAccuracy = (
  drawingData: ImageData,
  solutionData: ImageData
): {
  accuracy: number;
  diff: string;
} => {
  const diff = Buffer.alloc(solutionData.data.length as number) as Buffer;
  const width = drawingData?.width;
  const height = drawingData?.height;
  const accuracy = Pixelmatch(
    solutionData?.data,
    drawingData?.data,
    diff,
    width,
    height,
    {
      threshold: 0,
    }
  );

  const percentage = 100 - (accuracy / (width * height)) * 100;
  return {
    accuracy: percentage,
    diff: diff.toString("base64"),
  };
};

export default calculateAccuracy;
