import { BadRequestException } from '@nestjs/common';
import { RequestStatus } from '@prisma/client';

type EligibilityParams = {
  status: RequestStatus;
  closedAt: Date | null;
  minClosedDays: number;
  now?: Date;
};

const terminalStatuses = new Set<RequestStatus>([
  RequestStatus.DONE,
  RequestStatus.REJECTED,
  RequestStatus.CANCELED,
]);

export function normalizeAnonymizeReason(reason: string) {
  return reason.trim().replace(/\s+/g, ' ');
}

export function assertAnonymizeEligibility(params: EligibilityParams) {
  if (!terminalStatuses.has(params.status)) {
    throw new BadRequestException({
      code: 'REQUEST_NOT_TERMINAL',
      message: 'Request must be in terminal status before anonymization',
    });
  }

  if (!params.closedAt) {
    throw new BadRequestException({
      code: 'REQUEST_NOT_CLOSED',
      message: 'Request closedAt is required before anonymization',
    });
  }

  if (params.minClosedDays <= 0) {
    return;
  }

  const now = params.now ?? new Date();
  const eligibleOn = new Date(
    params.closedAt.getTime() + params.minClosedDays * 24 * 60 * 60 * 1000,
  );

  if (eligibleOn > now) {
    throw new BadRequestException({
      code: 'REQUEST_ANONYMIZE_TOO_EARLY',
      message: 'Request cannot be anonymized yet based on policy window',
      minClosedDays: params.minClosedDays,
      eligibleOn: eligibleOn.toISOString(),
    });
  }
}
