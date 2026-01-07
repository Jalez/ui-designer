"use client";

import { BubbleMenu, useCurrentEditor } from "@tiptap/react";
import { Image } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { fileSelectionStore } from "@/components/scriba/file-management/stores/fileSelectionStore";
import { Button } from "@/components/tailwind/ui/button";
import { Checkbox } from "@/components/tailwind/ui/checkbox";
import { Input } from "@/components/tailwind/ui/input";
import { DimensionOptionButton } from "./DimensionOptionButton";
import { generateImageFromPrompt } from "./generate-image-extension";
import { useImageGenerationBubbleMenu } from "./imageGenerationBubbleMenuStore";

const DIMENSION_OPTIONS = [
    { value: "800x600", label: "800 × 600" },
    { value: "1024x1024", label: "1024 × 1024" },
    { value: "1024x1536", label: "1024 × 1536" },
    { value: "1536x1024", label: "1536 × 1024" },
] as const;

interface ImageGenerationBubbleMenuProps {
    addLocalSourceFile?: (sourceFile: any) => void;
    documentId?: string;
    onCreditsUpdated?: (remainingCredits: number) => void | Promise<void>;
}

export function ImageGenerationBubbleMenu({
    addLocalSourceFile,
    documentId,
    onCreditsUpdated,
}: ImageGenerationBubbleMenuProps) {
    const { editor } = useCurrentEditor();
    const { isOpen, close } = useImageGenerationBubbleMenu();
    const [prompt, setPrompt] = useState("");
    const [dimensions, setDimensions] = useState("800x600");
    const [rounded, setRounded] = useState(true);
    const inputRef = useRef<HTMLInputElement>(null);

    // Ensure editor has focus and valid selection when opening
    // Force a detectable editor state change to trigger BubbleMenu's shouldShow re-evaluation
    useEffect(() => {
        if (isOpen && editor) {
            // Ensure editor is focused
            editor.commands.focus();

            // Use requestAnimationFrame to ensure this happens after React renders
            // and the store state change has propagated to the component
            requestAnimationFrame(() => {
                const { state } = editor;
                const { selection } = state;
                const { from } = selection;
                const docSize = state.doc.content.size;

                // Only proceed if we have a valid position
                if (from >= 0 && from <= docSize) {
                    // Ensure we have a valid text selection (not empty)
                    if (selection.empty) {
                        editor.commands.setTextSelection(from);
                    }

                    // Force a detectable state change by moving the selection slightly and back
                    // This ensures TipTap's BubbleMenu re-evaluates shouldShow immediately
                    // We move the selection by 1 position (if possible) and then back to trigger
                    // a state change that TipTap will detect
                    const targetPos = Math.min(from + 1, docSize);
                    if (targetPos > from && targetPos <= docSize) {
                        // Move selection forward by 1, then back to original position
                        // This creates a detectable state change
                        editor.commands.setTextSelection(targetPos);

                        // Immediately move back to original position in the next frame
                        requestAnimationFrame(() => {
                            editor.commands.setTextSelection(from);
                        });
                    } else {
                        // If we can't move forward, ensure selection is set (even if same position)
                        // This should still trigger a state update through the command
                        editor.commands.setTextSelection(from);
                    }
                }
            });
        }
    }, [isOpen, editor]);

    // Focus input when menu opens
    useEffect(() => {
        if (isOpen && inputRef.current) {
            // Small delay to ensure the menu is rendered
            setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
        }
    }, [isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editor || !prompt.trim()) return;

        // Get selected source files
        const selectedSourceFileIds = Array.from(fileSelectionStore.getState().globalSelectedItems) as string[];

        // Generate image with prompt and dimensions
        const fullPrompt = dimensions ? `${prompt} ${dimensions}` : prompt;
        generateImageFromPrompt(
            editor,
            fullPrompt,
            addLocalSourceFile,
            documentId,
            onCreditsUpdated,
            selectedSourceFileIds,
            rounded,
        );

        // Reset form and close the bubble menu
        setPrompt("");
        close();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Escape") {
            close();
        }
    };

    if (!editor || !isOpen) return null;

    return (
        // Wrap in div to prevent double-destroy issue (see https://github.com/ueberdosis/tiptap/issues/2658)
        // Use key prop to prevent unnecessary remounting
        <div key="image-generation-bubble-menu">
            <BubbleMenu
                editor={editor}
                shouldShow={() => {
                    // Show whenever our store says it's open
                    // We control visibility via the store, not selection state
                    return isOpen;
                }}
                tippyOptions={{
                    placement: "bottom-start",
                    offset: [0, 8],
                    duration: 100,
                    interactive: true,
                    hideOnClick: false,
                    appendTo: document.body, // Silence accessibility warning - we handle focus management
                    onClickOutside: (_instance, event) => {
                        // Don't close if the click is within the BubbleMenu form content
                        const target = event.target as HTMLElement;
                        if (target) {
                            const formElement = target.closest("form");
                            if (formElement) {
                                // Click is inside the form, don't close
                                return;
                            }
                        }
                        // Close the modal for outside clicks
                        close();
                    },
                    onDestroy: () => {
                        // Prevent double-destroy warnings by ensuring cleanup
                        // This is called when tippy instance is destroyed
                    },
                }}
            >
                <form
                    onSubmit={handleSubmit}
                    className={`${rounded ? "rounded-lg" : ""} bg-background p-2 shadow-lg overflow-hidden border border-border space-y-1.5 min-w-[280px]`}
                >
                    <div className="flex items-center gap-1.5">
                        <Image className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <h3 className="text-xs font-semibold leading-tight">Generate Image</h3>
                    </div>

                    <div className="space-y-0.5">
                        <label htmlFor="image-prompt" className="text-xs font-medium text-muted-foreground leading-tight">
                            Prompt
                        </label>
                        <Input
                            id="image-prompt"
                            ref={inputRef}
                            type="text"
                            placeholder="Describe what image to generate..."
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="h-8 w-full text-sm py-1.5"
                        />
                    </div>

                    <div className="space-y-0.5">
                        <fieldset className="border-0 p-0 m-0">
                            <legend className="text-xs font-medium text-muted-foreground leading-tight mb-1">Dimensions</legend>
                            <div className="flex flex-wrap gap-1">
                                {DIMENSION_OPTIONS.map((option) => (
                                    <DimensionOptionButton
                                        key={option.value}
                                        value={option.value}
                                        label={option.label}
                                        isSelected={dimensions === option.value}
                                        onClick={() => setDimensions(option.value)}
                                    />
                                ))}
                            </div>
                        </fieldset>
                    </div>

                    <div className="flex items-center gap-2">
                        <Checkbox
                            id="image-rounded"
                            checked={rounded}
                            onCheckedChange={(checked) => {
                                setRounded(checked === true);
                            }}
                            onClick={(e) => {
                                e.stopPropagation();
                            }}
                            className="h-4 w-4 border-primary data-[state=checked]:bg-primary data-[state=checked]:text-white"
                        />
                        <label
                            htmlFor="image-rounded"
                            className="text-xs font-medium text-muted-foreground leading-tight cursor-pointer select-none"
                            onClick={(e) => {
                                e.stopPropagation();
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setRounded(!rounded);
                                }
                            }}
                        >
                            Rounded corners
                        </label>
                    </div>

                    <div className="flex justify-end gap-1.5 pt-0.5">
                        <Button type="button" variant="ghost" size="sm" onClick={close} className="h-7 px-2.5 text-xs py-0">
                            Cancel
                        </Button>
                        <Button type="submit" size="sm" disabled={!prompt.trim()} className="h-7 px-2.5 text-xs py-0">
                            Generate
                        </Button>
                    </div>
                </form>
            </BubbleMenu>
        </div>
    );
}
