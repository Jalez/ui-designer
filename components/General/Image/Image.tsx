/** @format */
'use client';

import { Spinner } from "../Spinner/Spinner";

// interface
interface ModelProps {
  imageUrl: string;
  height: number;
  width: number;
  name?: string;
}

export const Image = ({
  imageUrl,
  height,
  width,
  name,
}: ModelProps): React.ReactNode => {
  // if (name) console.log(name, height, width);
  return (
    <div
      aria-label={name ? `${name} image` : "image"}
      className="m-0"
      style={{ height: `${height}px` }}
    >
      <div>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="The image that the user will draw a copy of"
            width={width}
          />
        ) : (
          <Spinner height={height} width={width} />
        )}
      </div>
    </div>
  );
};
