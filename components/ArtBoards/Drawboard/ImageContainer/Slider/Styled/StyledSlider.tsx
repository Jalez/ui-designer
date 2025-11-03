'use client';

interface StyledSliderProps extends React.InputHTMLAttributes<HTMLInputElement> {
  height: number;
}

export const StyledSlider = ({ height, className, style, ...props }: StyledSliderProps) => {
  return (
    <>
      <input
        type="range"
        className={className}
        style={{
          WebkitAppearance: 'none',
          appearance: 'none',
          width: '100%',
          height: '100%',
          margin: '0px',
          background: 'none',
          opacity: 0.3,
          transition: 'opacity 0.3s',
          borderRadius: '0px',
          border: 'none',
          cursor: 'col-resize',
          ...style,
        }}
        {...props}
      />
      <style dangerouslySetInnerHTML={{ __html: `
        input[type="range"].slider:hover {
          opacity: 1 !important;
        }
        input[type="range"].slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 4px;
          height: ${height}px;
          background: #000000;
          border-radius: 0px;
          box-shadow: 0 0 4px rgba(0, 0, 0, 0.5);
        }
        input[type="range"].slider::-moz-range-thumb {
          appearance: none;
          border: none;
          width: 4px;
          height: ${height}px;
          background: #000000;
          border-radius: 0px;
          box-shadow: 0 0 4px rgba(0, 0, 0, 0.5);
        }
      ` }} />
    </>
  );
};

export default StyledSlider;
