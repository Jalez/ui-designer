import type {
  DrawboardSnapshotPayload,
  EventSequence,
  EventSequenceStep,
  InteractionArtifacts,
  InteractionEventType,
  InteractionTrigger,
  VerifiedInteraction,
} from "@/types";

const SUPPORTED_EVENT_TYPES: InteractionEventType[] = ["click", "change", "input", "submit", "keydown"];

function sanitizeText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function isReplayOnlyFormEvent(step: Pick<EventSequenceStep, "eventType" | "showInTimeline" | "selector">): boolean {
  return step.showInTimeline === false
    && Boolean(step.selector)
    && (step.eventType === "input" || step.eventType === "change");
}

function shouldCollapseReplayOnlyStepPair(previous: EventSequenceStep | undefined, next: EventSequenceStep): previous is EventSequenceStep {
  return Boolean(
    previous
    && isReplayOnlyFormEvent(previous)
    && isReplayOnlyFormEvent(next)
    && previous.eventType === next.eventType
    && previous.selector === next.selector,
  );
}

function normalizeEventSequenceStep(
  scenarioId: string,
  entry: EventSequenceStep,
  order: number,
): EventSequenceStep {
  return {
    ...entry,
    scenarioId,
    order: Number.isFinite(entry.order) ? entry.order : order,
    showInTimeline: entry.showInTimeline !== false,
    label: sanitizeText(entry.label) || entry.eventType,
    instruction: sanitizeText(entry.instruction) || sanitizeText(entry.label) || entry.eventType,
    selector: sanitizeText(entry.selector),
    keyFilter: sanitizeText(entry.keyFilter),
    targetSummary: sanitizeText(entry.targetSummary),
  };
}

function collapseReplayOnlyStepPair(previous: EventSequenceStep, next: EventSequenceStep): EventSequenceStep {
  return {
    ...next,
    id: previous.id,
    scenarioId: previous.scenarioId,
    order: previous.order,
    preHash: previous.preHash,
  };
}

function isDuplicateEventSequenceStep(existing: EventSequenceStep[], step: EventSequenceStep): boolean {
  return existing.some((entry) =>
    entry.id === step.id
    || (
      entry.eventType === step.eventType
      && entry.selector === step.selector
      && entry.postHash === step.postHash
      && entry.keyFilter === step.keyFilter
    )
    || (
      entry.postHash === step.postHash
      && entry.label === step.label
      && entry.instruction === step.instruction
    ));
}

export function appendNormalizedEventSequenceStep(
  existing: EventSequenceStep[],
  scenarioId: string,
  step: EventSequenceStep,
): EventSequenceStep[] {
  const normalizedStep = normalizeEventSequenceStep(scenarioId, step, existing.length);
  if (isDuplicateEventSequenceStep(existing, normalizedStep)) {
    return existing;
  }

  const previous = existing[existing.length - 1];
  if (shouldCollapseReplayOnlyStepPair(previous, normalizedStep)) {
    return [
      ...existing.slice(0, -1),
      collapseReplayOnlyStepPair(previous, {
        ...normalizedStep,
        order: previous.order,
      }),
    ];
  }

  return [
    ...existing,
    {
      ...normalizedStep,
      order: existing.length,
    },
  ];
}

export function normalizeInteractionTrigger(
  trigger: string | Partial<InteractionTrigger>,
  index = 0,
): InteractionTrigger | null {
  if (typeof trigger === "string") {
    const eventType = trigger.trim() as InteractionEventType;
    if (!SUPPORTED_EVENT_TYPES.includes(eventType)) {
      return null;
    }
    return {
      id: `legacy-${eventType}-${index}`,
      eventType,
      label: eventType,
    };
  }

  const eventType = trigger.eventType?.trim() as InteractionEventType | undefined;
  if (!eventType || !SUPPORTED_EVENT_TYPES.includes(eventType)) {
    return null;
  }

  return {
    id: sanitizeText(trigger.id) || `trigger-${eventType}-${index}`,
    eventType,
    selector: sanitizeText(trigger.selector),
    keyFilter: sanitizeText(trigger.keyFilter),
    label: sanitizeText(trigger.label) || eventType,
  };
}

export function normalizeInteractionTriggers(
  triggers: Array<string | Partial<InteractionTrigger>> | undefined,
): InteractionTrigger[] {
  if (!Array.isArray(triggers)) {
    return [];
  }

  const seenIds = new Set<string>();
  const normalized: InteractionTrigger[] = [];

  triggers.forEach((trigger, index) => {
    const value = normalizeInteractionTrigger(trigger, index);
    if (!value) {
      return;
    }

    let nextId = value.id;
    let suffix = 1;
    while (seenIds.has(nextId)) {
      suffix += 1;
      nextId = `${value.id}-${suffix}`;
    }
    seenIds.add(nextId);
    normalized.push({ ...value, id: nextId });
  });

  return normalized;
}

export function normalizeInteractionArtifacts(
  artifacts: InteractionArtifacts | undefined,
): InteractionArtifacts | undefined {
  if (!artifacts?.byScenarioId || typeof artifacts.byScenarioId !== "object") {
    return undefined;
  }

  const byScenarioId: Record<string, VerifiedInteraction[]> = {};
  for (const [scenarioId, entries] of Object.entries(artifacts.byScenarioId)) {
    if (!Array.isArray(entries) || !scenarioId) {
      continue;
    }
    byScenarioId[scenarioId] = entries.filter((entry): entry is VerifiedInteraction => {
      return typeof entry?.id === "string"
        && typeof entry?.triggerId === "string"
        && typeof entry?.eventType === "string"
        && typeof entry?.createdAt === "string"
        && typeof entry?.preHash === "string"
        && typeof entry?.postHash === "string"
        && (entry?.verificationSource === "dom" || entry?.verificationSource === "pixel")
        && typeof entry?.sequence === "number";
    });
  }

  return { byScenarioId };
}

function isSnapshotPayload(value: unknown): value is DrawboardSnapshotPayload {
  return Boolean(
    value
    && typeof value === "object"
    && typeof (value as DrawboardSnapshotPayload).css === "string"
    && typeof (value as DrawboardSnapshotPayload).snapshotHtml === "string"
    && typeof (value as DrawboardSnapshotPayload).width === "number"
    && typeof (value as DrawboardSnapshotPayload).height === "number",
  );
}

export function normalizeEventSequence(
  sequence: EventSequence | undefined,
): EventSequence | undefined {
  if (!sequence?.byScenarioId || typeof sequence.byScenarioId !== "object") {
    return undefined;
  }

  const byScenarioId: Record<string, EventSequenceStep[]> = {};
  for (const [scenarioId, entries] of Object.entries(sequence.byScenarioId)) {
    if (!scenarioId || !Array.isArray(entries)) {
      continue;
    }

    const normalizedEntries = entries
      .filter((entry): entry is EventSequenceStep => {
        return typeof entry?.id === "string"
          && typeof entry?.scenarioId === "string"
          && typeof entry?.order === "number"
          && SUPPORTED_EVENT_TYPES.includes(entry?.eventType as InteractionEventType)
          && typeof entry?.label === "string"
          && typeof entry?.instruction === "string"
          && typeof entry?.preHash === "string"
          && typeof entry?.postHash === "string"
          && (entry?.verificationSource === "dom" || entry?.verificationSource === "pixel")
          && isSnapshotPayload(entry?.snapshot);
      })
      .map((entry, index) => normalizeEventSequenceStep(scenarioId, entry, index))
      .sort((a, b) => a.order - b.order)
      .reduce<EventSequenceStep[]>((acc, entry) => appendNormalizedEventSequenceStep(acc, scenarioId, entry), [])
      .map((entry, index) => ({
        ...entry,
        order: index,
      }));

    byScenarioId[scenarioId] = normalizedEntries;
  }

  return { byScenarioId };
}

export function stepToInteractionTrigger(step: Pick<EventSequenceStep, "id" | "eventType" | "selector" | "keyFilter" | "label">): InteractionTrigger {
  return {
    id: step.id,
    eventType: step.eventType,
    selector: step.selector,
    keyFilter: step.keyFilter,
    label: step.label,
  };
}
