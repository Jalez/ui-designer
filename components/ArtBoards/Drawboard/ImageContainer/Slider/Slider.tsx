/** @format */

import { StyledSlider } from "./Styled/StyledSlider";
// import "./Slider.css";
interface SliderProps {
  sliderValue: number;
  dragSlider: (e: any) => void;
  resetSlider: () => void;
  sliderHeight: number;
}

import { StyledSliderContainer } from "./Styled/StyledSliderContainer";

/**
 * The slider component
 * @description - the slider component is used to show the user how much of the image they have drawn
 * @param sliderValue - the value of the slider *
 * @param dragSlider - the function that is called when the slider is dragged, ie when the mouse is moved over the slider
 * @param resetSlider - the function that is called when the slider is released, ie when the mouse leaves the slider
 */

const onChange = (e: any) => {
  // do nothing
};
export const Slider = ({
  sliderValue,
  dragSlider,
  resetSlider,
  sliderHeight,
}: SliderProps) => {
  return (
    <StyledSliderContainer>
      <StyledSlider
        type="range"
        min="0"
        max="100"
        value={sliderValue}
        className="slider"
        id="myRange"
        height={sliderHeight}
        onMouseMove={dragSlider}
        onMouseLeave={resetSlider}
        onChange={onChange}
      />
    </StyledSliderContainer>
  );
};
