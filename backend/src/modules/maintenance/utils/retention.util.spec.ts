import { cutoffFromDays } from './retention.util';

describe('cutoffFromDays', () => {
  it('subtracts day count from date', () => {
    const now = new Date('2026-03-08T10:00:00.000Z');
    const cutoff = cutoffFromDays(7, now);

    expect(cutoff.toISOString()).toBe('2026-03-01T10:00:00.000Z');
  });
});
