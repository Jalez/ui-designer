'use client';

import { useCallback, useState } from "react";
import SlideContainer from "./SlideContainer";
import { mainColor } from "@/constants";

interface SliderProps {
  sliderValue: number;
  dragSlider: (e: any) => void;
  resetSlider: () => void;
  hidden?: boolean;
  needsPress?: boolean;
  orientation?: "horizontal" | "vertical";
}

const dividerStyles: any = (orientation: string, hideSlider: boolean) => ({
  minWidth: "5px",
  minHeight: "5px",
  // height: orientation === "vertical" ? "100%" : "5px",
  width: orientation === "horizontal" ? "100%" : "5px",
  position: "relative",
  backgroundColor: "primary.main.100",
  zIndex: hideSlider ? 20 : 50,
  cursor: orientation === "horizontal" ? "ns-resize" : "ew-resize",
});

export const Slider = ({
  sliderValue,
  dragSlider,
  resetSlider,
  needsPress = false,
  orientation = "vertical",
}: SliderProps) => {
  const [hideSlider, setHideSlider] = useState<boolean>(true);
  const [mousePressed, setMousePressed] = useState<boolean>(false);
  const [mouseDragged, setMouseDragged] = useState<boolean>(false);
  const [newSliderValue, setNewSliderValue] = useState<number>(sliderValue);

  const handleMouseDrag = (e: any) => {
    if (needsPress && mousePressed) {
      setMouseDragged(true);
      if (orientation === "horizontal" && e.clientY > window.innerHeight - 40) {
        return;
      } else if (
        orientation === "vertical" &&
        (e.clientX > window.innerWidth - 200 || e.clientX < 200)
      ) {
        return;
      }
      dragSlider(e);
    }
    if (!needsPress) {
      setMouseDragged(true);
      dragSlider(e);
    }
  };

  const handleMouseLeave = useCallback(
    (e: any) => {
      if (!mouseDragged) {
        setMousePressed(false);
        setHideSlider(true);
        resetSlider();
      }
    },
    [mouseDragged]
  );

  const handleMousePress = useCallback((e: any) => {
    // console.log("mouse pressed", e.clientX, e.clientY);
    setMousePressed(true);
    setHideSlider(false);
  }, []);

  const handleMouseRelease = useCallback((e: any) => {
    setMousePressed(false);
    setMouseDragged(false);
    setHideSlider(true);
    const x = e.clientX;
    const sliderWidth = window.innerWidth;
    setNewSliderValue((x / sliderWidth) * 100);
    resetSlider();
  }, []);

  const handleMouseEnter = useCallback(() => {
    if (mousePressed) setMousePressed(false);
  }, [mousePressed]);

  return (
    <>
      <div
        className="relative cursor-ns-resize"
        style={{
          minWidth: orientation === "horizontal" ? "100%" : "5px",
          minHeight: orientation === "vertical" ? "100%" : "5px",
          width: orientation === "horizontal" ? "100%" : "5px",
          backgroundColor: mainColor + "1a",
          zIndex: hideSlider ? 20 : 50,
          cursor: orientation === "horizontal" ? "ns-resize" : "ew-resize",
        }}
        onMouseEnter={handleMouseEnter}
        onMouseDown={handleMousePress}
      />
      <SlideContainer
        opacity={mousePressed ? 0.25 : 0}
        background={mainColor}
        zIndex={hideSlider ? 4 : 100}
        hidden={hideSlider}
        onMouseMove={handleMouseDrag}
        onMouseLeave={handleMouseLeave}
        onMouseUp={handleMouseRelease}
      />
    </>
  );
};
