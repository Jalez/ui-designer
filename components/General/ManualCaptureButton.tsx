import { Camera } from "lucide-react";
import { Button } from "../ui/button";
import PoppingTitle from "./PoppingTitle";
import { FrameHandle } from "../ArtBoards/Frame";

export function ManualCaptureButton({
    busy,
    frameRef,
    title,
  }: {
    busy: boolean;
    frameRef: React.RefObject<FrameHandle | null>;
    title: string;
  }) {
    return (
      <PoppingTitle topTitle={title}>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-9 w-9 rounded-full bg-muted text-foreground shadow-sm hover:bg-muted/85"
          disabled={busy}
          aria-label={title}
          onClick={() => frameRef.current?.requestCapture()}
        >
          <Camera className="h-5 w-5" />
        </Button>
      </PoppingTitle>
    );
  }
  