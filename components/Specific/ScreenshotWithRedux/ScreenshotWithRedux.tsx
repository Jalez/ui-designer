/** @format */

import { useState } from "react";
import { useScreenshotUpdate } from "../../../store/hooks/hooks";
import { ScreenShotter } from "../../General/Screenshotter/Screenshotter";

type ScreenshotWithReduxProps = {
  imageUrl: string;
  name: string;
  scenarioId: string;
  children?: React.ReactNode;
};

const ScreenshotWithRedux = ({
  imageUrl,
  name,
  scenarioId,
  children,
}: ScreenshotWithReduxProps) => {
  const { updateScreenshot } = useScreenshotUpdate(scenarioId);
  const [oldImageUrl, setOldImageUrl] = useState("no image");

  const handleUpdate = (name: string, imageUrl: string) => {
    if (imageUrl !== oldImageUrl) {
      updateScreenshot(name, imageUrl);
      setOldImageUrl(imageUrl);
    }
  };
  return (
    <ScreenShotter
      screenshotName={name}
      takeScreenshotWhen={imageUrl !== oldImageUrl}
      triggerCondition={imageUrl}
      updateScreenshot={handleUpdate}
    >
      {children}
    </ScreenShotter>
  );
};

export default ScreenshotWithRedux;
