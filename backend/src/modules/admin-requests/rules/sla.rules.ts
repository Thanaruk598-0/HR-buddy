import { Prisma, RequestStatus, SlaStatus } from '@prisma/client';

export async function updateSlaOnStatusChange(
  tx: Prisma.TransactionClient,
  requestId: string,
  status: RequestStatus,
) {
  const sla = await tx.requestSla.findUnique({
    where: { requestId },
  });

  if (!sla) return;

  if (status === 'DONE') {
    await tx.requestSla.update({
      where: { requestId },
      data: {
        slaStatus: SlaStatus.ON_TRACK,
        lastCalculatedAt: new Date(),
      },
    });
  }
}
