import { SlaStatus } from '@prisma/client';
import { calculateSlaStatus } from './sla.rules';

describe('calculateSlaStatus', () => {
  const start = new Date('2026-03-01T00:00:00.000Z');
  const due = new Date('2026-03-01T10:00:00.000Z');

  it('returns ON_TRACK when before yellow threshold', () => {
    const now = new Date('2026-03-01T06:59:59.000Z');

    const status = calculateSlaStatus({
      now,
      slaStartAt: start,
      slaDueAt: due,
      yellowThresholdPercent: 70,
    });

    expect(status).toBe(SlaStatus.ON_TRACK);
  });

  it('returns NEAR_BREACH when crossing yellow threshold', () => {
    const now = new Date('2026-03-01T07:00:00.000Z');

    const status = calculateSlaStatus({
      now,
      slaStartAt: start,
      slaDueAt: due,
      yellowThresholdPercent: 70,
    });

    expect(status).toBe(SlaStatus.NEAR_BREACH);
  });

  it('returns OVERDUE when past due date', () => {
    const now = new Date('2026-03-01T10:00:00.001Z');

    const status = calculateSlaStatus({
      now,
      slaStartAt: start,
      slaDueAt: due,
      yellowThresholdPercent: 70,
    });

    expect(status).toBe(SlaStatus.OVERDUE);
  });

  it('clamps threshold and handles non-positive duration', () => {
    const status = calculateSlaStatus({
      now: new Date('2026-03-01T00:00:00.000Z'),
      slaStartAt: start,
      slaDueAt: start,
      yellowThresholdPercent: 150,
    });

    expect(status).toBe(SlaStatus.ON_TRACK);
  });
});
