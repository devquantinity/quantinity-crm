import { beforeEach, describe, expect, it } from 'vitest';

import { claim, isRunning, release, resetInFlight, runOnce } from 'src/lib/in-flight';

beforeEach(() => resetInFlight());

describe('claim', () => {
  it('lets the first caller through and nobody else', () => {
    expect(claim('issue', 'q1')).toBe(true);
    expect(claim('issue', 'q1')).toBe(false);
    expect(claim('issue', 'q1')).toBe(false);
  });

  it('lets it run again once released', () => {
    claim('issue', 'q1');
    release('issue', 'q1');

    expect(claim('issue', 'q1')).toBe(true);
  });

  it('does not block a different record', () => {
    claim('issue', 'q1');

    expect(claim('issue', 'q2')).toBe(true);
  });

  it('does not block a different action on the same record', () => {
    // Issuing an invoice and marking it paid are different irreversible things.
    claim('issue', 'inv1');

    expect(claim('mark-paid', 'inv1')).toBe(true);
  });
});

describe('runOnce', () => {
  it('runs the work and reports that it ran', async () => {
    const outcome = await runOnce('issue', 'q1', async () => 'Q-0001');

    expect(outcome).toEqual({ ran: true, result: 'Q-0001' });
  });

  it('refuses a second call while the first is still in the air', async () => {
    // The case this exists for: two clicks before the first reply comes back.
    let releaseFirst: (value: string) => void = () => {};
    const pending = new Promise<string>((resolve) => {
      releaseFirst = resolve;
    });

    const first = runOnce('issue', 'q1', () => pending);
    const second = await runOnce('issue', 'q1', async () => 'SHOULD NOT HAPPEN');

    expect(second.ran).toBe(false);
    expect(second.result).toBeUndefined();

    releaseFirst('Q-0001');
    expect((await first).result).toBe('Q-0001');
  });

  it('stays retryable after the work throws', async () => {
    // A failed issue that wedges the button shut for the rest of the session
    // would be worse than the double-submit it was guarding against.
    await expect(
      runOnce('issue', 'q1', async () => {
        throw new Error('network died');
      }),
    ).rejects.toThrow('network died');

    expect(isRunning('issue', 'q1')).toBe(false);
    expect(claim('issue', 'q1')).toBe(true);
  });

  it('lets the next attempt through after a successful one', async () => {
    await runOnce('issue', 'q1', async () => 'first');
    const again = await runOnce('issue', 'q1', async () => 'second');

    expect(again).toEqual({ ran: true, result: 'second' });
  });
});
