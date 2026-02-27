import { PageContainer } from "@/components/scriba/ui/PageContainer";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const quickStart = [
  "Sign in and open or create a game from the sidebar list.",
  "Use Creator Mode to edit levels, templates, and solutions.",
  "Switch to Test Mode to validate the learner experience with the current template.",
  "Save level changes from Creator Tools to persist your work.",
  "Open Game Settings to configure visibility, sharing, work mode, collaborators, and access controls.",
];

const troubleshooting = [
  {
    issue: "I cannot edit code",
    fix: "Check if the tab is locked in Creator Mode and verify you have creator access (owner/collaborator).",
  },
  {
    issue: "Shared link says game not found or access denied",
    fix: "Confirm the game is public, the share token is current, access window allows current time, and access key (if required) is correct.",
  },
  {
    issue: "I expected multiplayer but got an individual instance",
    fix: "Set Work Mode to Group in Game Settings. Individual mode always keeps users in their own instance.",
  },
  {
    issue: "Collaboration presence/cursors are not visible",
    fix: "Multiplayer features appear only on group collaboration pages when group mode is active.",
  },
];

export default function HelpPage() {
  return (
    <PageContainer className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto py-10 px-4 space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">UI Designer Help</h1>
        <p className="text-muted-foreground">
          Practical guide for creating, testing, sharing, and running UI Designer games.
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
        <AccordionItem value="modes" className="border rounded-md px-4">
          <AccordionTrigger>Modes: Creator, Test, and Game</AccordionTrigger>
          <AccordionContent className="text-sm space-y-2">
            <p>
              Creator Mode is for authoring tasks and level content. Test Mode lets you run through the same task flow as a learner.
              Game Mode is the constrained learner view used in share/play flows.
            </p>
            <p>
              Mode switching is URL-driven (`?mode=creator`, `?mode=test`, `?mode=game`) so links and embeds can force the expected
              experience.
            </p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="work-mode" className="border rounded-md px-4">
          <AccordionTrigger>Work Mode: Individual vs Group</AccordionTrigger>
          <AccordionContent className="text-sm space-y-2">
            <p>
              Each game has a Work Mode in Game Settings:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Individual</strong>: everyone works in their own instance.
              </li>
              <li>
                <strong>Group</strong>: users with a group context are routed to the shared group workspace for multiplayer collaboration.
              </li>
            </ul>
            <p>
              This setting decides whether group pages are used for a game. It is independent of normal owner/collaborator edit rights.
            </p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="settings" className="border rounded-md px-4">
          <AccordionTrigger>Game Settings Overview</AccordionTrigger>
          <AccordionContent className="text-sm space-y-2">
            <p>Game Settings include:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Visibility (public/private)</li>
              <li>Share link generation/regeneration</li>
              <li>Work Mode (individual/group)</li>
              <li>Creator access (add/remove collaborators)</li>
              <li>Access window (optional start/end availability)</li>
              <li>Access key requirement and key regeneration (optional)</li>
              <li>Sidebar visibility for players</li>
              <li>Game thumbnail selection</li>
            </ul>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="creator-access" className="border rounded-md px-4">
          <AccordionTrigger>Creator Access and Ownership Rules</AccordionTrigger>
          <AccordionContent className="text-sm space-y-2">
            <p>
              The original creator (owner) has ultimate rights. Collaborators can edit the game and can add new collaborators, but only
              the original creator can remove collaborators or delete the game.
            </p>
            <p>
              The owner cannot be removed from their own game.
            </p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="ai" className="border rounded-md px-4">
          <AccordionTrigger>AI Generation and Provider Settings</AccordionTrigger>
          <AccordionContent className="text-sm space-y-2">
            <p>
              Creator tools include AI-assisted level and code generation. Provider settings are configured in Account Settings under
              <strong> AI Generation Settings</strong>.
            </p>
            <p>
              You can set an OpenAI-compatible endpoint, model ID, and optional API key override for your browser session.
            </p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="troubleshooting" className="border rounded-md px-4">
          <AccordionTrigger>Troubleshooting</AccordionTrigger>
          <AccordionContent className="text-sm space-y-3">
            {troubleshooting.map((item) => (
              <div key={item.issue}>
                <p className="font-medium">{item.issue}</p>
                <p className="text-muted-foreground">{item.fix}</p>
              </div>
            ))}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      </div>
    </PageContainer>
  );
}
