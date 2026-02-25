/** @format */
'use client';

import { useAppSelector } from "@/store/hooks/hooks";

// create prop interface
interface NavTextProps {
  children: any;
}
/**
 * @description InfoText is a component that displays text in the InfoBoard component
 * @param {NavTextProps} props - props for component,
 * @param {any} props.children - children of component
 * @returns {React.ReactNode}
 */
export const InfoText = ({ children }: NavTextProps) => {
  const options = useAppSelector((state) => state.options);
  const isCreator = options.creator;
  // if in creator mode, show an input instead of text
  if (isCreator) {
    return <div>{children}</div>;
  }
  return (
    <p className="select-none">
      {children}
    </p>
  );
};
