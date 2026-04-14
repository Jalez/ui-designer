import { describe, expect, test } from "bun:test";
import type { EventSequenceStep } from "@/types";
import { appendNormalizedEventSequenceStep, normalizeEventSequence } from "./interactionEvents";

function makeStep(overrides: Partial<EventSequenceStep> = {}): EventSequenceStep {
  return {
    id: "step-1",
    scenarioId: "scenario-1",
    order: 0,
    eventType: "input",
    showInTimeline: false,
    selector: "#password",
    label: "Update input#password",
    instruction: "Update input#password",
    verificationSource: "dom",
    preHash: "pre-1",
    postHash: "post-1",
    snapshot: {
      css: "",
      snapshotHtml: '<input id="password" value="1" />',
      width: 100,
      height: 50,
    },
    ...overrides,
  };
}

describe("interactionEvents replay-only normalization", () => {
  test("appendNormalizedEventSequenceStep collapses adjacent replay-only input events", () => {
    const first = makeStep();
    const second = makeStep({
      id: "step-2",
      order: 1,
      preHash: "pre-2",
      postHash: "post-2",
      snapshot: {
        css: "",
        snapshotHtml: '<input id="password" value="12" />',
        width: 100,
        height: 50,
      },
    });

    const appended = appendNormalizedEventSequenceStep([first], "scenario-1", second);

    expect(appended).toHaveLength(1);
    expect(appended[0]).toMatchObject({
      id: "step-1",
      order: 0,
      eventType: "input",
      selector: "#password",
      preHash: "pre-1",
      postHash: "post-2",
    });
    expect(appended[0]?.snapshot.snapshotHtml).toContain('value="12"');
  });

  test("normalizeEventSequence upgrades persisted replay-only input runs", () => {
    const sequence = normalizeEventSequence({
      byScenarioId: {
        "scenario-1": [
          makeStep(),
          makeStep({
            id: "step-2",
            order: 1,
            preHash: "pre-2",
            postHash: "post-2",
            snapshot: {
              css: "",
              snapshotHtml: '<input id="password" value="12" />',
              width: 100,
              height: 50,
            },
          }),
          makeStep({
            id: "visible-step",
            order: 2,
            eventType: "click",
            showInTimeline: true,
            selector: "#submit",
            label: "Click button#submit",
            instruction: "Click button#submit",
            preHash: "pre-3",
            postHash: "post-3",
            snapshot: {
              css: "",
              snapshotHtml: '<button id="submit">Submit</button>',
              width: 100,
              height: 50,
            },
          }),
        ],
      },
    });

    expect(sequence?.byScenarioId["scenario-1"]).toHaveLength(2);
    expect(sequence?.byScenarioId["scenario-1"]?.[0]).toMatchObject({
      id: "step-1",
      order: 0,
      showInTimeline: false,
      preHash: "pre-1",
      postHash: "post-2",
    });
    expect(sequence?.byScenarioId["scenario-1"]?.[1]).toMatchObject({
      id: "visible-step",
      order: 1,
      showInTimeline: true,
    });
  });
});
