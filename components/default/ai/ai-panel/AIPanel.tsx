import type { Editor } from "@tiptap/core";
import { Drawer, DrawerContentRight } from "@/components/tailwind/ui/drawer";
import { RightPanelContainer } from "./AIPanelContainer";

export const AIPanel = ({
  editor,
  isMobileRightPanelOpen,
  setIsMobileRightPanelOpen,
}: {
  editor: Editor;
  isMobileRightPanelOpen: boolean;
  setIsMobileRightPanelOpen: (open: boolean) => void;
}) => {
  return (
    <>
      {/* Desktop Files Panel */}
      <div className="hidden xl:block">
        <RightPanelContainer editor={editor} />
      </div>

      {/* Mobile Files Panel Drawer */}
      <Drawer open={isMobileRightPanelOpen} onOpenChange={setIsMobileRightPanelOpen} direction="right">
        <DrawerContentRight className="xl:hidden">
          <RightPanelContainer editor={editor} isMobile={true} onClose={() => setIsMobileRightPanelOpen(false)} />
        </DrawerContentRight>
      </Drawer>
    </>
  );
};
