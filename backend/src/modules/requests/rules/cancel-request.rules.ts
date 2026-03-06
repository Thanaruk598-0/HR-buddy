import { BadRequestException } from '@nestjs/common';
import { RequestStatus } from '@prisma/client';

const EMPLOYEE_CANCELABLE_STATUSES: RequestStatus[] = [
  RequestStatus.NEW,
  RequestStatus.APPROVED,
];

export function assertEmployeeCancelableStatus(status: RequestStatus) {
  if (!EMPLOYEE_CANCELABLE_STATUSES.includes(status)) {
    throw new BadRequestException({
      code: 'REQUEST_NOT_CANCELABLE_BY_EMPLOYEE',
      message: `Employee can cancel only ${EMPLOYEE_CANCELABLE_STATUSES.join(', ')}`,
    });
  }
}

export function normalizeCancelReason(reason: string) {
  return reason.trim().replace(/\s+/g, ' ');
}
