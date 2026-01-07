import { ArrowDownWideNarrow, CheckCheck, RefreshCcwDot, StepForward, WrapText } from "lucide-react";
import { getPrevText, useEditor } from "novel";
import { useEffect, useState } from "react";
import { useCreditsStore } from "../../../credits";
import { CommandGroup, CommandItem, CommandSeparator } from "../../../../tailwind/ui/command";

const options = [
  {
    value: "improve",
    label: "Improve writing",
    icon: RefreshCcwDot,
    creditCost: 4,
  },
  {
    value: "fix",
    label: "Fix grammar",
    icon: CheckCheck,
    creditCost: 4,
  },
  {
    value: "shorter",
    label: "Make shorter",
    icon: ArrowDownWideNarrow,
    creditCost: 4,
  },
  {
    value: "longer",
    label: "Make longer",
    icon: WrapText,
    creditCost: 4,
  },
];

interface AISelectorCommandsProps {
  onSelect: (value: string, option: string) => void;
}

const AISelectorCommands = ({ onSelect }: AISelectorCommandsProps) => {
  const { editor } = useEditor();
  const { credits, checkCreditsForService, updateCreditsLocally } = useCreditsStore();
  const [creditStatus, setCreditStatus] = useState<{ hasEnough: boolean; requiredCredits: number } | null>(null);

  useEffect(() => {
    const checkCredits = async () => {
      if (credits) {
        const status = await checkCreditsForService("AI Text Completion");
        setCreditStatus({
          hasEnough: status.hasEnough,
          requiredCredits: status.requiredCredits,
        });
      }
    };
    checkCredits();
  }, [credits, checkCreditsForService]);

  return (
    <>
      <CommandGroup heading="Edit or review selection">
        {options.map((option) => {
          const hasEnoughCredits = creditStatus?.hasEnough ?? true;
          const isDisabled = !hasEnoughCredits;

          return (
            <CommandItem
              onSelect={(value) => {
                if (isDisabled) return;
                const slice = editor.state.selection.content();
                const text = editor.storage.markdown.serializer.serialize(slice.content);
                onSelect(text, value);
              }}
              className={`flex gap-2 px-4 ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
              key={option.value}
              value={option.value}
              disabled={isDisabled}
            >
              <option.icon className="h-4 w-4 text-purple-500" />
              <span className="flex-1">{option.label}</span>
              <span
                className={`text-xs px-2 py-1 rounded ${hasEnoughCredits ? "bg-purple-100 text-purple-700" : "bg-red-100 text-red-700"}`}
              >
                {option.creditCost} credit{option.creditCost !== 1 ? "s" : ""}
              </span>
            </CommandItem>
          );
        })}
      </CommandGroup>
      <CommandSeparator />
      <CommandGroup heading="Use AI to do more">
        <CommandItem
          onSelect={() => {
            if (!creditStatus?.hasEnough) return;
            const pos = editor.state.selection.from;
            const text = getPrevText(editor, pos);
            onSelect(text, "continue");
          }}
          value="continue"
          className={`gap-2 px-4 ${!creditStatus?.hasEnough ? "opacity-50 cursor-not-allowed" : ""}`}
          disabled={!creditStatus?.hasEnough}
        >
          <StepForward className="h-4 w-4 text-purple-500" />
          <span className="flex-1">Continue writing</span>
          <span
            className={`text-xs px-2 py-1 rounded ${creditStatus?.hasEnough ? "bg-purple-100 text-purple-700" : "bg-red-100 text-red-700"}`}
          >
            4 credits
          </span>
        </CommandItem>
      </CommandGroup>
    </>
  );
};

export default AISelectorCommands;
