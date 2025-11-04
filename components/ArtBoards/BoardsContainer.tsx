/** @format */


interface BoardsContainerProps {
  children: React.ReactNode;
}

export const BoardsContainer = ({ children }: BoardsContainerProps) => {
  return (
    <div className="boards-container" >
      {children}
    </div>
  );
};
