"use client";

import { User } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface AvatarProps {
  src?: string;
  alt?: string;
  fallback?: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  onError?: () => void;
}

const sizeClasses = {
  sm: "h-6 w-6",
  md: "h-8 w-8",
  lg: "h-12 w-12",
  xl: "h-16 w-16",
};

export const Avatar: React.FC<AvatarProps> = ({ src, alt = "Avatar", fallback, className, size = "md", onError }) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  // Reset error state when src changes
  useEffect(() => {
    if (src) {
      setImageError(false);
      setImageLoading(true);
    }
  }, [src]);

  const handleImageError = () => {
    setImageError(true);
    setImageLoading(false);
    onError?.();
  };

  const handleImageLoad = () => {
    setImageLoading(false);
  };

  const renderFallback = () => {
    if (fallback) {
      return fallback;
    }
    return <User className="h-4 w-4 text-gray-500" />;
  };

  const avatarSize = sizeClasses[size];

  if (!src || imageError) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700",
          avatarSize,
          className,
        )}
      >
        {renderFallback()}
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden rounded-full", avatarSize, className)}>
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-cover"
        onError={handleImageError}
        onLoad={handleImageLoad}
        referrerPolicy="no-referrer"
        crossOrigin="anonymous"
      />
      {imageLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-200 dark:bg-gray-700">
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
        </div>
      )}
    </div>
  );
};
