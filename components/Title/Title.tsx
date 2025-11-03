'use client';

import { secondaryColor } from "@/constants";

export const Title = () => {
  return (
    <div
      className="m-0 p-4 text-center select-none z-[1] bg-no-repeat bg-center"
      style={{ color: secondaryColor }}
    >
      <h1
        id="main-title"
        className="text-4xl font-bold text-primary"
      >
        UI Designer
      </h1>
      <h2 id="sub-title" className="text-3xl font-semibold">
        Layouts
      </h2>
    </div>
  );
};
