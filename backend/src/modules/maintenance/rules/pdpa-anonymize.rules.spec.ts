import { BadRequestException } from '@nestjs/common';
import { RequestStatus } from '@prisma/client';
import {
  assertAnonymizeEligibility,
  normalizeAnonymizeReason,
} from './pdpa-anonymize.rules';

describe('pdpa-anonymize rules', () => {
  it('normalizes reason spacing', () => {
    expect(normalizeAnonymizeReason('  PDPA   remove   data ')).toBe(
      'PDPA remove data',
    );
  });

  it('rejects non-terminal request status', () => {
    expect(() =>
      assertAnonymizeEligibility({
        status: RequestStatus.NEW,
        closedAt: new Date('2026-03-01T00:00:00.000Z'),
        minClosedDays: 30,
        now: new Date('2026-04-01T00:00:00.000Z'),
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects anonymization when policy window is not reached', () => {
    expect(() =>
      assertAnonymizeEligibility({
        status: RequestStatus.DONE,
        closedAt: new Date('2026-03-01T00:00:00.000Z'),
        minClosedDays: 30,
        now: new Date('2026-03-15T00:00:00.000Z'),
      }),
    ).toThrow(BadRequestException);
  });

  it('allows anonymization when closed request passes policy window', () => {
    expect(() =>
      assertAnonymizeEligibility({
        status: RequestStatus.CANCELED,
        closedAt: new Date('2026-03-01T00:00:00.000Z'),
        minClosedDays: 7,
        now: new Date('2026-03-10T00:00:00.000Z'),
      }),
    ).not.toThrow();
  });
});
