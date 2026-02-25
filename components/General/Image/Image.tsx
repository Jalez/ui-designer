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
  return (
    <div
      aria-label={name ? `${name} image` : "image"}
      className="relative group"
    >
      <div style={{ height: `${height}px`, width: `${width}px` }}>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="The image that the user will draw a copy of"
            width={width}
            height={height}
            style={{ width: `${width}px`, height: `${height}px`, display: "block" }}
          />
        ) : (
          <Spinner height={height} width={width} />
        )}
      </div>
      {imageUrl && (
        <div className="absolute top-1 right-1 bg-black/70 text-white text-xs px-2 py-1 rounded font-mono opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {width}px x {height}px
        </div>
      )}
    </div>
  );
};
