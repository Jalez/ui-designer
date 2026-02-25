import { Button } from "@/components/ui/button";
import { useSidebarCollapse } from "./context/SidebarCollapseContext";

export const ExpandButton = () => {
    const { isCollapsed, isMobile, openOverlay, toggleCollapsed } = useSidebarCollapse();

    const handleSidebarClick = () => {
        if (isMobile) {
            openOverlay();
        } else if (isCollapsed) {
            toggleCollapsed();
        }
    };

    return (
        <Button
            variant="ghost"
            className={`flex-1 w-full h-full rounded-none bg-transparent hover:bg-transparent focus:bg-transparent border-none p-0 flex items-center justify-center ${isCollapsed && !isMobile ? "cursor-expand-sidebar" : ""}`}
            onClick={(e) => {
                e.stopPropagation();
                handleSidebarClick();
            }}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSidebarClick();
                }
            }}
            tabIndex={-1}
            aria-label="Expand sidebar"
            disabled={!isCollapsed && !isMobile}
        />
    );
};
