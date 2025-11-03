/** @format */
'use client';

// import { htmlElementsArray } from "./HTMLElements";
import { WordCloud } from "./WordCloud/WordCloud";
import { cssPropertiesArray } from "./CSSProperties";

export const CSSWordCloud = () => {
  return (
    <div className="absolute z-0 bottom-[10%] left-0 p-0 m-0 w-full flex justify-center overflow-hidden">
      <WordCloud words={cssPropertiesArray} />
    </div>
  );
};
