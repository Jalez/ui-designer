/** @format */
'use client';

import { secondaryColor, mainColor } from "@/constants";
import "./Spinner.css";

type SpinnerProps = {
  height: number;
  width: number;
};

export const Spinner = ({ height, width }: SpinnerProps): React.ReactNode => {
  return (
    <div
      className="flex flex-col justify-center items-center"
      style={{
        height: `${height}px`,
        width: `${width}px`,
        backgroundColor: secondaryColor,
        color: mainColor,
      }}
    >
      <svg
        className="spinner"
        width="65px"
        height="65px"
        viewBox="0 0 66 66"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle className="path" fill="none" cx="33" cy="33" r="30" />
      </svg>
      <h6 className="text-lg font-semibold" style={{ color: mainColor }}>
        Loading solution image...
      </h6>
      <p className="text-base text-center" style={{ color: mainColor }}>
        (If this takes too long, please refresh the page. This is a known issue
        and will be fixed in the future.)
      </p>
    </div>
  );
};
