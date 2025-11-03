/** @format */
'use client';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useEffect, useRef, useState } from "react";
import { useAppSelector } from "@/store/hooks/hooks";

const url = process.env.NEXT_PUBLIC_LOCAL_TESTING_URL || '';

// interface
interface InfoPictureProps {
  picture: string;
}

export const InfoPicture = ({
  picture,
}: InfoPictureProps): React.ReactNode | null => {
  const [popUp, setPopUp] = useState(false);
  const pictureRef = useRef<HTMLParagraphElement>(null);
  const [popUpMessage, setPopUpMessage] = useState("Copied to the clipboard");

  const [copying, setCopying] = useState(false);
  // Get the color code from the state

  // get the current level from the store state

  useEffect(() => {
    if (copying) {
      setTimeout(() => {
        setPopUp(false);
        setCopying(false);
      }, 500);
    }
  }, [copying]);

  const clickHandler = (
    event: React.MouseEvent<HTMLParagraphElement, MouseEvent>
  ) => {
    // When the p is clicked, copy the color code to the clipboard
    navigator.clipboard.writeText((url + picture) as string);
    // alert the user that the color code has been copied
    // alert('Copied to clipboard');
    setPopUp(true);
    setCopying(true);
    setPopUpMessage("Copied to the clipboard");
  };

  const mouseEnterHandler = (
    event: React.MouseEvent<HTMLParagraphElement, MouseEvent>
  ) => {
    setPopUpMessage("Click to copy to the clipboard");
    setPopUp(true);
  };

  const mouseOutHandler = (
    event: React.MouseEvent<HTMLParagraphElement, MouseEvent>
  ) => {
    setPopUp(false);
  };

  if (!picture) return null;

  return (
    <div className="m-[10px]">
      <Popover open={popUp}>
        <PopoverTrigger asChild>
          <div
            ref={pictureRef}
            onClick={clickHandler}
            onMouseEnter={mouseEnterHandler}
            onMouseLeave={mouseOutHandler}
            className="cursor-pointer"
          >
            <img
              id="building-block-picture"
              className="rounded-[20px]"
              alt="building block"
              src={picture as string}
              height="200px"
            />
          </div>
        </PopoverTrigger>
        <PopoverContent className="m-2.5 pointer-events-none">
          {popUpMessage}
        </PopoverContent>
      </Popover>
    </div>
  );
};
