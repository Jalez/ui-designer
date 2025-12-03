import { cn } from "@/lib/utils";

function Skeleton({ className, style, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-md bg-muted animate-pulse", className)}
      style={style}
      {...props}
    />
  );
}

export { Skeleton };
