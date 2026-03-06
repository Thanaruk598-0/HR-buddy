import { BadRequestException } from '@nestjs/common';
import { RequestStatus } from '@prisma/client';
import {
  assertEmployeeCancelableStatus,
  normalizeCancelReason,
} from './cancel-request.rules';

describe('cancel-request rules', () => {
  it.each<RequestStatus>(['NEW', 'APPROVED'])(
    'allows employee cancel from %s',
    (status) => {
      expect(() => assertEmployeeCancelableStatus(status)).not.toThrow();
    },
  );

  it.each<RequestStatus>([
    'IN_PROGRESS',
    'IN_TRANSIT',
    'DONE',
    'REJECTED',
    'CANCELED',
  ])('rejects employee cancel from %s', (status) => {
    expect(() => assertEmployeeCancelableStatus(status)).toThrow(
      BadRequestException,
    );
  });

  it('normalizes reason spacing', () => {
    expect(normalizeCancelReason('  please   cancel   this  ')).toBe(
      'please cancel this',
    );
  });
});
