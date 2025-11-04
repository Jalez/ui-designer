'use client';

import { ReactNode } from 'react';

type SidebySideArtProps = {
  contents: ReactNode[];
};

const SidebySideArt = ({ contents }: SidebySideArtProps): ReactNode => {
  return (
    <div className="flex flex-row justify-center items-center w-full h-full flex-wrap">
      {contents.map((content, index) => (
        <div key={`sidebyside-${index}`} className="shrink-0">
          {content}
        </div>
      ))}
    </div>
  );
};

export default SidebySideArt;
