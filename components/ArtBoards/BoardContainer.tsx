'use client';

interface BoardContainerProps {
  width: number;
  children?: React.ReactNode;
}

export const BoardContainer = ({ width, children }: BoardContainerProps) => {
  return (
    <div
      className="flex flex-row justify-center items-center flex-[1_0_auto] flex-shrink-0 m-2"
      style={{ width: `${width}px` }}
    >
      {children}
    </div>
  );
};
