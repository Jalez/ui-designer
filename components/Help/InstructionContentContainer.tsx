/** @format */
'use client';

interface InstructionContentProps {
  children: React.ReactNode;
}
const InstructionContent = ({ children }: InstructionContentProps) => {
  return (
    <div className="flex flex-col justify-between grow">
      {children}
    </div>
  );
};

export default InstructionContent;
