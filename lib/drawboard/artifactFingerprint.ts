import type { scenario, EventSequenceStep } from "@/types";
import { hashArtifactFingerprint } from "@/lib/drawboard/artifactCache";

export function drawingArtifactFingerprint(input: {
  html: string;
  css: string;
  js: string;
  scenario: scenario;
}): string {
  return hashArtifactFingerprint([
    "drawing",
    input.html,
    input.css,
    input.js,
    input.scenario.js ?? "",
    input.scenario.dimensions.width,
    input.scenario.dimensions.height,
  ]);
}

export function solutionArtifactFingerprint(input: {
  html: string;
  css: string;
  js: string;
  scenario: scenario;
}): string {
  return hashArtifactFingerprint([
    "solution",
    input.html,
    input.css,
    input.js,
    input.scenario.js ?? "",
    input.scenario.dimensions.width,
    input.scenario.dimensions.height,
  ]);
}

export function solutionStepArtifactFingerprint(input: {
  solutionFingerprint: string;
  step: EventSequenceStep;
}): string {
  return hashArtifactFingerprint([
    "solution-step",
    input.solutionFingerprint,
    input.step.id,
    input.step.snapshot.snapshotHtml,
    input.step.snapshot.css,
    input.step.snapshot.width,
    input.step.snapshot.height,
  ]);
}
