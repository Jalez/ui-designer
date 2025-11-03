'use client';

export type errorObj = {
  message: string;
  lineno?: number;
  colno?: number;
};

type FallbackProps = {
  error: errorObj;
};

export const ErrorFallback = ({ error }: FallbackProps) => {
  return (
    <div
      role="alert"
      className="absolute inset-0 flex flex-col items-center justify-center bg-red-500/50 text-white"
    >
      <h2 className="text-2xl font-bold mb-4 text-white">
        Oops! Something went wrong :(
      </h2>
      <pre className="text-base whitespace-pre-wrap text-center font-bold text-white">
        {error.message}
      </pre>
      <pre>
        {error.lineno && error.colno && (
          <span>
            Line number: {error.lineno}, column number: {error.colno}
          </span>
        )}
      </pre>
    </div>
  );
};

