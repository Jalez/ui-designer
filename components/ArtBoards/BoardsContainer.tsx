/** @format */


interface BoardsContainerProps {
  children: React.ReactNode;
}

export const BoardsContainer = ({ children }: BoardsContainerProps) => {
  return (
    <div className="boards-container h-full flex flex-col items-center justify-center">
      {children}
    </div>
  );
};
