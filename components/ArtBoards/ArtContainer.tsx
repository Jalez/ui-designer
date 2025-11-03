/** @format */
'use client';

interface ArtContainerProps {
  children: React.ReactNode;
  height?: number;
  width?: number;
}

export const ArtContainer = ({
  children,
  height,
  width,
}: ArtContainerProps) => {
  return (
    <div
      className="img-container relative z-[2]"
      style={{
        height: height ? `${height}px` : undefined,
        width: width ? `${width}px` : undefined,
      }}
    >
      {children}
    </div>
  );
};
