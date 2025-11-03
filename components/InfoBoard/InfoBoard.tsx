import { StyledInfoBoard } from "./Styled/StyledInfoBoard";
import { StyledInfoBoardContainer } from "./Styled/StyledInfoBoardContainer";
import { StyledChildContainer } from "./Styled/StyledChildContainer";

interface InfoBoardProps {
  children: any;
}

export const InfoBoard = ({ children }: InfoBoardProps) => {
  return (
    <StyledInfoBoard id="info-board">
      <StyledInfoBoardContainer id="info-board-container">
        {/* map through children */}
        {children.length > 1
          ? children.map((child: any, index: number) => (
              <StyledChildContainer key={Math.random() * 1000000}>
                {child}
              </StyledChildContainer>
            ))
          : children}{" "}
      </StyledInfoBoardContainer>
    </StyledInfoBoard>
  );
};
