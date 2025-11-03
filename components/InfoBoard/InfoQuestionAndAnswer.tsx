'use client';

import { useAppSelector } from "@/store/hooks/hooks";
import { secondaryColor, mainColor } from "@/constants";

export const InfoQuestionAndAnswer = () => {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);

  return (
    <section
      className="flex flex-col justify-center items-center p-4 rounded-2xl w-full flex-auto h-full overflow-auto m-4 z-10 shadow-[0_0_10px_0px_rgba(0,0,0,0.5)]"
      style={{
        backgroundColor: secondaryColor,
        color: mainColor,
      }}
    >
      <header>
        <h2 className="text-2xl font-semibold">{level?.question_and_answer?.question || "No question"}</h2>
      </header>
      <p>{level?.question_and_answer?.answer || "No answer"}</p>
    </section>
  );
};
