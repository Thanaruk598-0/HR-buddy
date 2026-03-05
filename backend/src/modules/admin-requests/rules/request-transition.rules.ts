import { BadRequestException } from '@nestjs/common';
import { RequestStatus } from '@prisma/client';

const TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  NEW: ['APPROVED', 'REJECTED', 'CANCELED'],

  APPROVED: ['IN_PROGRESS', 'DONE', 'CANCELED'],

  IN_PROGRESS: ['IN_TRANSIT', 'DONE', 'CANCELED'],

  IN_TRANSIT: ['DONE'],

  DONE: [],

  REJECTED: [],

  CANCELED: [],
};

export function assertValidTransition(from: RequestStatus, to: RequestStatus) {
  const allowed = TRANSITIONS[from] ?? [];

  if (!allowed.includes(to)) {
    throw new BadRequestException({
      code: 'INVALID_STATUS_TRANSITION',
      message: `Cannot change status from ${from} to ${to}`,
    });
  }
}
