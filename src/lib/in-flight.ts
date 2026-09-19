/**
 * Stop the same irreversible action running twice at once.
 *
 * Every one of these commands consumes something that cannot be handed back: a
 * document number, a client link, a project with its milestones. The server
 * refuses a SECOND attempt once the first has landed - a quote that is already
 * ISSUED is no longer DRAFT. What it cannot refuse is a second attempt that
 * arrives while the first is still in the air, because at that moment the record
 * still says DRAFT to both of them.
 *
 * So the cheapest and most effective guard is here, before the request leaves:
 * one action, one record, one attempt at a time. This does not make the server
 * safe against two browsers - see the note in the issue routes - but it does
 * make a double-click, an impatient second Enter, and a re-fired command into
 * exactly one request, which is every case that actually happens to one person
 * using this.
 *
 * Module scope on purpose. A useRef resets when the component remounts, and a
 * headless command remounts every time it runs.
 */

const inFlight = new Set<string>();

const keyOf = (action: string, recordId: string) => `${action}:${recordId}`;

/** True if this one is yours to run. False means it is already going. */
export const claim = (action: string, recordId: string) => {
  const key = keyOf(action, recordId);

  if (inFlight.has(key)) return false;

  inFlight.add(key);

  return true;
};

export const release = (action: string, recordId: string) => {
  inFlight.delete(keyOf(action, recordId));
};

export const isRunning = (action: string, recordId: string) =>
  inFlight.has(keyOf(action, recordId));

/** For tests only - the set is module state and would leak between cases. */
export const resetInFlight = () => inFlight.clear();

/**
 * Run it once, or not at all.
 *
 * The release is in a finally, so a thrown request does not wedge the action
 * shut for the rest of the session - a failed issue must stay retryable.
 */
export const runOnce = async <T>(
  action: string,
  recordId: string,
  work: () => Promise<T>,
): Promise<{ ran: true; result: T } | { ran: false; result?: undefined }> => {
  if (!claim(action, recordId)) return { ran: false };

  try {
    return { ran: true, result: await work() };
  } finally {
    release(action, recordId);
  }
};
