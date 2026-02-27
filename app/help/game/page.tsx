import { PageContainer } from "@/components/scriba/ui/PageContainer";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const quickStart = [
  "Open the level and compare your output with the target model in the artboard.",
  "Edit HTML/CSS/JS in the editors until your implementation matches the target.",
  "Use level navigation to move through tasks.",
  "Watch points/accuracy updates as you improve the solution.",
  "Submit your final work through your course flow (for LTI/A+ scenarios).",
];

export default function GameHelpPage() {
  return (
    <PageContainer className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto py-10 px-4 space-y-6">
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
              In player/game mode, you work inside the provided template. If something is marked locked,
              it is intentionally fixed for that task.
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
              Contact your instructor/creator for a fresh link or key.
            </p>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      </div>
    </PageContainer>
  );
}
