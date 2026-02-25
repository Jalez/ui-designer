"use client";

import type React from "react";
import { createContext, useCallback, useContext, useState } from "react";

interface LoadingState {
    isLoading: boolean;
    loadingItem?: string;
    loadingMessage?: string;
}

interface LoadingContextType {
    loadingState: LoadingState;
    setLoading: (isLoading: boolean, item?: string, message?: string) => void;
    setSidebarLoading: (itemId: string, isLoading: boolean) => void;
    setPageLoading: (isLoading: boolean, message?: string) => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export const useLoading = () => {
    const context = useContext(LoadingContext);
    if (!context) {
        throw new Error("useLoading must be used within a LoadingProvider");
    }
    return context;
};

interface LoadingProviderProps {
    children: React.ReactNode;
}

export const LoadingProvider: React.FC<LoadingProviderProps> = ({ children }) => {
    const [loadingState, setLoadingState] = useState<LoadingState>({
        isLoading: false,
    });

    const setLoading = useCallback((isLoading: boolean, item?: string, message?: string) => {
        setLoadingState({
            isLoading,
            loadingItem: item,
            loadingMessage: message,
        });
    }, []);

    const setSidebarLoading = useCallback((itemId: string, isLoading: boolean) => {
        setLoadingState((prev) => ({
            ...prev,
            isLoading,
            loadingItem: isLoading ? itemId : undefined,
            loadingMessage: isLoading ? "Loading..." : undefined,
        }));
    }, []);

    const setPageLoading = useCallback((isLoading: boolean, message?: string) => {
        setLoadingState({
            isLoading,
            loadingItem: undefined,
            loadingMessage: message || "Loading page...",
        });
    }, []);

    return (
        <LoadingContext.Provider
            value={{
                loadingState,
                setLoading,
                setSidebarLoading,
                setPageLoading,
            }}
        >
            {children}
        </LoadingContext.Provider>
    );
};
