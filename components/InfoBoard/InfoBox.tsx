'use client';

const InfoBox = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex flex-row items-center rounded-2xl pr-2 pl-2 border-primary">
      {children}
    </div>
  );
};

export default InfoBox;
