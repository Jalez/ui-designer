"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { stripBasePath } from "@/lib/apiUrl";

export function useIsCreatorRoute(): boolean {
  const pathname = usePathname();
  return useMemo(
    () => stripBasePath(pathname ?? "").startsWith("/creator/"),
    [pathname],
  );
}
