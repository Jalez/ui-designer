'use client';

export const StyledSliderContainer = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="absolute m-0 p-0 top-0 left-0 w-full h-full overflow-hidden z-[3]">
      {children}
    </div>
  );
};
