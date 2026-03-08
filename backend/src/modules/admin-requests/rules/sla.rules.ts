import { Prisma, RequestStatus, SlaStatus } from '@prisma/client';

const TERMINAL_STATUSES: RequestStatus[] = [
  RequestStatus.DONE,
  RequestStatus.REJECTED,
  RequestStatus.CANCELED,
];

export function calculateSlaStatus(params: {
  now: Date;
  slaStartAt: Date;
  slaDueAt: Date;
  yellowThresholdPercent: number;
}): SlaStatus {
  const { now, slaStartAt, slaDueAt, yellowThresholdPercent } = params;

  if (now.getTime() > slaDueAt.getTime()) {
    return SlaStatus.OVERDUE;
  }

  const totalDurationMs = slaDueAt.getTime() - slaStartAt.getTime();

  if (totalDurationMs <= 0) {
    return SlaStatus.ON_TRACK;
  }

  const clampedThreshold = Math.max(0, Math.min(100, yellowThresholdPercent));
  const yellowAtMs =
    slaStartAt.getTime() + (totalDurationMs * clampedThreshold) / 100;

  if (now.getTime() >= yellowAtMs) {
    return SlaStatus.NEAR_BREACH;
  }

  return SlaStatus.ON_TRACK;
}

export async function recalculateSlaForRequest(
  tx: Prisma.TransactionClient,
  requestId: string,
  now = new Date(),
) {
  const row = await tx.requestSla.findUnique({
    where: { requestId },
    include: {
      request: {
        select: {
          id: true,
          type: true,
          urgency: true,
          status: true,
        },
      },
    },
  });

  if (!row) {
    return null;
  }

  if (TERMINAL_STATUSES.includes(row.request.status)) {
    await tx.requestSla.update({
      where: { requestId },
      data: {
        slaStatus: SlaStatus.ON_TRACK,
        lastCalculatedAt: now,
      },
    });

    return SlaStatus.ON_TRACK;
  }

  const policy = await tx.slaPolicy.findFirst({
    where: {
      requestType: row.request.type,
      urgency: row.request.urgency,
      isActive: true,
    },
    orderBy: { id: 'desc' },
    select: {
      yellowThresholdPercent: true,
    },
  });

  const nextStatus = calculateSlaStatus({
    now,
    slaStartAt: row.slaStartAt,
    slaDueAt: row.slaDueAt,
    yellowThresholdPercent: policy?.yellowThresholdPercent ?? 80,
  });

  await tx.requestSla.update({
    where: { requestId },
    data: {
      slaStatus: nextStatus,
      lastCalculatedAt: now,
    },
  });

  return nextStatus;
}

export async function updateSlaOnStatusChange(
  tx: Prisma.TransactionClient,
  requestId: string,
  status: RequestStatus,
  now = new Date(),
) {
  if (TERMINAL_STATUSES.includes(status)) {
    const exists = await tx.requestSla.findUnique({
      where: { requestId },
      select: { requestId: true },
    });

    if (!exists) {
      return;
    }

    await tx.requestSla.update({
      where: { requestId },
      data: {
        slaStatus: SlaStatus.ON_TRACK,
        lastCalculatedAt: now,
      },
    });

    return;
  }

  await recalculateSlaForRequest(tx, requestId, now);
}

export function isTerminalRequestStatus(status: RequestStatus) {
  return TERMINAL_STATUSES.includes(status);
}
