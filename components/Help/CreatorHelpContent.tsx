import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const quickStart = [
  "Sign in and open or create a game from the sidebar list.",
  "Use the creator route to edit levels, templates, and solutions.",
  "Switch to the game route to validate the learner experience with the current template.",
  "Save level changes from Creator Tools to persist your work.",
  "Open Game Settings to configure visibility, sharing, work mode, collaborators, and access controls.",
  "In group-mode games, creators can open Creator Preview first and use the game navbar to jump into active group instances.",
];

const troubleshooting = [
  {
    issue: "I cannot edit code",
    fix: "Check if the tab is locked in the creator route and verify you have creator access (owner/collaborator).",
  },
  {
    issue: "Shared link says game not found or access denied",
    fix: "Confirm the game is public, access window allows current time, and access key (if required) is correct.",
  },
  {
    issue: "I expected multiplayer but got an individual instance",
    fix: "Set Work Mode to Group in Game Settings. Individual mode always keeps users in their own instance.",
  },
  {
    issue: "Collaboration presence/cursors are not visible",
    fix: "Multiplayer features appear when group mode is active and a valid group instance is open. Players must belong to a group first; creators can jump between active group instances from the game navbar.",
  },
];

export function CreatorHelpContent() {
  return (
    <div className="space-y-6">
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
          <AccordionTrigger>Routes: Creator and Game</AccordionTrigger>
          <AccordionContent className="text-sm space-y-2">
            <p>
              The creator route is for authoring tasks and level content. The game route is the constrained learner view used in gameplay and shared links.
            </p>
            <p>
              Creator routes use <code>/creator/[gameId]</code>, while game/player routes use <code>/game/[gameId]</code>.
            </p>
            <p>
              Each new game gets its own cloned map and level records, so edits in one game do not overwrite another game.
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
                <strong>Group</strong>: players choose one of their existing groups in <code>/game/[gameId]</code> and then enter a shared multiplayer instance.
              </li>
            </ul>
            <p>
              This setting decides whether a group context is required to open gameplay. It is independent of normal owner/collaborator edit rights.
            </p>
            <p>
              If a player has not been added to a group yet, they cannot create one from the game entry screen. Game editors can still open the route in
              Creator Preview and use the navbar to switch into active group instances.
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
              <li>Game level imports create independent copies (no shared cross-game level edits)</li>
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
  );
}
