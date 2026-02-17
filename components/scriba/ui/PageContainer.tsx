// Stub: PageContainer is not used in ui-designer.
import type React from "react";

interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export const PageContainer: React.FC<PageContainerProps> = ({ children, ...props }) => (
  <div {...props}>{children}</div>
);
