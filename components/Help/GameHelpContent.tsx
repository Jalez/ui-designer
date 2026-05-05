import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const quickStart = [
  "Open the level and compare your output with the target model in the artboard.",
  "Edit HTML/CSS/JS in the editors until your implementation matches the target.",
  "Use level navigation to move through tasks.",
  "Watch points/accuracy updates as you improve the solution.",
  "Submit your final work through your course flow (for LTI/A+ scenarios).",
];

export function GameHelpContent() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Game Help (For Players)</h1>
        <p className="text-muted-foreground">
          This page explains how to complete tasks while playing a game.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Quick Start</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal pl-5 space-y-1 text-sm">
            {quickStart.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Accordion type="single" collapsible className="w-full space-y-2">
        <AccordionItem value="goal" className="border rounded-md px-4">
          <AccordionTrigger>Goal of a Level</AccordionTrigger>
          <AccordionContent className="text-sm space-y-2">
            <p>
              Your objective is to recreate the target UI as accurately as possible using the code editors.
              Some levels may lock certain editors, so work only with the allowed parts.
            </p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="scoring" className="border rounded-md px-4">
          <AccordionTrigger>Scoring and Accuracy</AccordionTrigger>
          <AccordionContent className="text-sm space-y-2">
            <p>
              The app evaluates visual/code output and updates accuracy/points as you progress.
              Higher similarity to the target yields higher points.
            </p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="modes" className="border rounded-md px-4">
          <AccordionTrigger>What You Can Edit</AccordionTrigger>
          <AccordionContent className="text-sm space-y-2">
            <p>
              On the game route, you work inside the provided template. If something is marked locked,
              it is intentionally fixed for that task.
            </p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="kbd" className="border rounded-md px-4">
          <AccordionTrigger>What is <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">kbd</code>?</AccordionTrigger>
          <AccordionContent className="text-sm space-y-2">
            <p>
              In the HTML editor you see your code wrapped with <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">&lt;div id=&quot;root&quot;&gt;&lt;kbd&gt;</code> and <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">&lt;/kbd&gt;&lt;/div&gt;</code>. These lines are fixed; you only edit the content between them.
            </p>
            <p>
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">kbd</code> is a standard HTML element. Here it is used as the inner container for your markup in the preview (drawboard). The structure is: <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">div#root</code> → <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">kbd</code> → your content. What you see in the editor matches what is actually rendered, so you can reason about layout and styling correctly.
            </p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="multiplayer" className="border rounded-md px-4">
          <AccordionTrigger>Group vs Individual Tasks</AccordionTrigger>
          <AccordionContent className="text-sm space-y-2">
            <p>
              Some games run in shared group mode (multiplayer), while others run as individual instances.
              This is controlled by the game&apos;s settings by the creator.
            </p>
            <p>
              If collaboration is enabled, edits/presence can appear in real-time for your group.
            </p>
            <p>
              In group mode, you can only enter with a group you already belong to. If no group appears on entry, ask the creator or instructor to add you first.
            </p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="access" className="border rounded-md px-4">
          <AccordionTrigger>Access Problems</AccordionTrigger>
          <AccordionContent className="text-sm space-y-2">
            <p>
              If you cannot open a game, the link may be expired, outside the allowed time window,
              private, or require an access key.
            </p>
            <p>
              For group-mode games, contact your instructor/creator if you still need to be added to the correct group. They can also open Creator Preview and jump into active group instances from the game navbar.
            </p>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
