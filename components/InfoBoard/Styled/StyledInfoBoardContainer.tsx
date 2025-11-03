'use client';

export const StyledInfoBoardContainer = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return (
    <div className={`flex justify-center items-center w-full h-full ${className || ''}`}>
      {children}
    </div>
  );
};
