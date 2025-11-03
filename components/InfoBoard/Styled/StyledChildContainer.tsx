'use client';

export const StyledChildContainer = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return (
    <div className={`w-full h-full flex-1 flex flex-row justify-center items-center ${className || ''}`}>
      {children}
    </div>
  );
};
