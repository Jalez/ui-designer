"use client";

import { Button } from "@/components/tailwind/ui/button";
import { Input } from "@/components/tailwind/ui/input";
import { useAIProviderConfig } from "@/components/default/ai/providers/stores/aiProviderConfigStore";

export function AiProviderSettingsSection() {
  const { config, setApiEndpoint, setModel, setApiKey, resetToDefaults } = useAIProviderConfig();

  return (
    <div id="ai-settings" className="rounded-lg border p-6 space-y-4 scroll-mt-24">
      <div>
        <h2 className="text-lg font-semibold">AI Generation Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">
          These settings are used by creator mode generation (level + editor magic actions).
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="ai-endpoint">
          API Endpoint
        </label>
        <Input
          id="ai-endpoint"
          value={config.apiEndpoint}
          onChange={(event) => setApiEndpoint(event.target.value)}
          placeholder="https://openrouter.ai/api/v1"
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">Use any OpenAI-compatible endpoint.</p>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="ai-model">
          Model
        </label>
        <Input
          id="ai-model"
          value={config.model}
          onChange={(event) => setModel(event.target.value)}
          placeholder="openai/gpt-4o-mini"
          className="font-mono text-sm"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="ai-key">
          API Key (optional override)
        </label>
        <Input
          id="ai-key"
          type="password"
          value={config.apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder="Leave empty to use server-side key"
          className="font-mono text-sm"
        />
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={resetToDefaults}>
          Reset to defaults
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Stored in your browser local storage for this device.
      </p>
    </div>
  );
}
