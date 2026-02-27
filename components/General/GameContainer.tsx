'use client';

interface GameContainerProps {
  children: React.ReactNode;
}

export const GameContainer = ({ children }: GameContainerProps) => {
  return (
    <div
      className="w-full relative flex-1 box-border border-none flex flex-col h-full"
    >
      {children}
    </div>
  );
};
