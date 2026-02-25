'use client';

import { useAppSelector } from "@/store/hooks/hooks";

type ArtTabsProps = {
  tabContents: React.ReactNode[];
};

const ArtTabs = ({
  tabContents,
}: ArtTabsProps): React.ReactNode => {
  const activeIndex = useAppSelector((state) => state.options.activeArtTab);

  return (
    <div className="flex flex-col justify-center items-center">
      {tabContents.map((content, index) => (
        <div
          key={index}
          className="w-full"
          style={{ display: index === activeIndex ? 'block' : 'none' }}
        >
          {content}
        </div>
      ))}
    </div>
  );
};

export default ArtTabs;
