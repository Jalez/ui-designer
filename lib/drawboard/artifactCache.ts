export type DrawboardArtifactType = "drawing" | "solution" | "solution-step";

export type DrawboardArtifactDescriptor = {
  version: "v1";
  artifactType: DrawboardArtifactType;
  fingerprint: string;
  gameId?: string | null;
  levelIdentifier?: string | null;
  levelName?: string | null;
  scenarioId: string;
  stepId?: string | null;
  width: number;
  height: number;
};

function stableHash(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index);
    h1 ^= code;
    h1 = Math.imul(h1, 16777619);
    h2 ^= code;
    h2 = Math.imul(h2, 2246822519);
  }
  return `${(h1 >>> 0).toString(16).padStart(8, "0")}${(h2 >>> 0).toString(16).padStart(8, "0")}`;
}

function normalizeField(value: string | null | undefined, fallback = "none"): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

export function buildArtifactKey(descriptor: DrawboardArtifactDescriptor): string {
  const raw = [
    descriptor.version,
    descriptor.artifactType,
    descriptor.fingerprint,
    normalizeField(descriptor.gameId),
    normalizeField(descriptor.levelIdentifier),
    normalizeField(descriptor.levelName),
    descriptor.scenarioId,
    normalizeField(descriptor.stepId),
    String(descriptor.width),
    String(descriptor.height),
  ].join("|");
  return stableHash(raw);
}

export function hashArtifactFingerprint(parts: Array<string | number | null | undefined>): string {
  return stableHash(parts.map((value) => String(value ?? "")).join("\u0000"));
}
