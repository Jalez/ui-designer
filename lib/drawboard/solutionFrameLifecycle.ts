/** When the live solution drawboard iframe is removed from the DOM (game route), clear pixel buffers that came from it. */

type Listener = (scenarioId: string) => void;

const listeners = new Set<Listener>();

export function subscribeLiveSolutionFrameRemoved(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function announceLiveSolutionFrameRemoved(scenarioId: string): void {
  listeners.forEach((l) => l(scenarioId));
}
