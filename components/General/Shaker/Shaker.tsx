'use client';

import { useState, useEffect, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type ShakerProps = {
  children: ReactNode;
  value: string | number;
};

const Shaker = ({ children, value }: ShakerProps) => {
  const [prevValue, setPrevValue] = useState<string | number>(value);
  const [shouldAnimate, setShouldAnimate] = useState(true);

  useEffect(() => {
    if (value !== prevValue) {
      setShouldAnimate(true);
      setTimeout(() => {
        setPrevValue(value);
      }, 1000);
    } else {
      setShouldAnimate(false);
    }
  }, [value, prevValue]);

  return (
    <span
      className={cn(
        "relative inline-block",
        shouldAnimate && "animate-shake"
      )}
    >
      {children}
    </span>
  );
};

export default Shaker;
