/** @format */

// ModelInfoBoard.tsx
import { InfoBoard } from "../../InfoBoard/InfoBoard";
import { InfoColors } from "../../InfoBoard/InfoColors";

type ModelInfoBoardProps = {
  showModel: boolean;
  setShowModel: (show: boolean) => void;
};

export const ModelInfoBoard = ({}: ModelInfoBoardProps) => (
  <InfoBoard>
    <InfoColors />
    {/* <InfoPictures /> */}
    {/* <InfoSwitch
			label={showModel ? 'Show model' : 'Show diff'}
			checked={showModel}
			switchHandler={() => setShowModel(!showModel)}
		/> */}
  </InfoBoard>
);
