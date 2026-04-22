'use client';

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type ArtboardActionBarContextValue = {
  drawingActions: ReactNode | null;
  modelActions: ReactNode | null;
  setDrawingActions: (actions: ReactNode | null) => void;
  setModelActions: (actions: ReactNode | null) => void;
};

const ArtboardActionBarContext = createContext<ArtboardActionBarContextValue | null>(null);

export function ArtboardActionBarProvider({ children }: { children: ReactNode }): React.ReactNode {
  const [drawingActions, setDrawingActions] = useState<ReactNode | null>(null);
  const [modelActions, setModelActions] = useState<ReactNode | null>(null);

  const value = useMemo(
    () => ({
      drawingActions,
      modelActions,
      setDrawingActions,
      setModelActions,
    }),
    [drawingActions, modelActions],
  );

  return (
    <ArtboardActionBarContext.Provider value={value}>
      {children}
    </ArtboardActionBarContext.Provider>
  );
}

export function useArtboardActionBar(): ArtboardActionBarContextValue {
  const ctx = useContext(ArtboardActionBarContext);
  if (!ctx) {
    throw new Error("useArtboardActionBar must be used within ArtboardActionBarProvider");
  }
  return ctx;
}
