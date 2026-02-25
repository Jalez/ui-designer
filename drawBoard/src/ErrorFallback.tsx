import { errorObj } from "./types";

type FallbackProps = {
  error: errorObj;
};

export const ErrorFallback = ({ error }: FallbackProps) => {
  return (
    <div
      role="alert"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        backgroundColor: "rgba(255, 0, 0, 0.5)",
        color: "white",
      }}
    >
      <h2
        style={{
          color: "white",
          fontSize: "1.5rem",
          fontWeight: "bold",
          marginBottom: "1rem",
        }}
      >
        Oops! Something went wrong :(
      </h2>
      <pre
        style={{
          color: "white",
          fontSize: "1rem",
          whiteSpace: "pre-wrap",
          textAlign: "center",
          // bold text
          fontWeight: "bold",
        }}
      >
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
