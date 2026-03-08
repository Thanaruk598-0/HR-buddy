import { BadRequestException } from '@nestjs/common';
import { RequestStatus } from '@prisma/client';

const MESSENGER_ALLOWED_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  NEW: [],
  APPROVED: [RequestStatus.IN_TRANSIT],
  IN_PROGRESS: [],
  IN_TRANSIT: [RequestStatus.DONE],
  DONE: [],
  REJECTED: [],
  CANCELED: [],
};

const MESSENGER_TARGET_STATUSES: RequestStatus[] = [
  RequestStatus.IN_TRANSIT,
  RequestStatus.DONE,
];

export function assertMessengerTargetStatus(status: RequestStatus) {
  if (!MESSENGER_TARGET_STATUSES.includes(status)) {
    throw new BadRequestException({
      code: 'INVALID_MESSENGER_TARGET_STATUS',
      message: `Messenger cannot set status to ${status}`,
    });
  }
}

export function assertMessengerTransition(
  from: RequestStatus,
  to: RequestStatus,
) {
  const allowed = MESSENGER_ALLOWED_TRANSITIONS[from] ?? [];

  if (!allowed.includes(to)) {
    throw new BadRequestException({
      code: 'INVALID_MESSENGER_STATUS_TRANSITION',
      message: `Messenger cannot change status from ${from} to ${to}`,
    });
  }
}
