import { Injectable } from '@nestjs/common';
import { SlaStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  calculateSlaStatus,
  isTerminalRequestStatus,
} from '../admin-requests/rules/sla.rules';

@Injectable()
export class SlaService {
  constructor(private readonly prisma: PrismaService) {}

  async recalculateAllOpen() {
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const policies = await tx.slaPolicy.findMany({
        where: { isActive: true },
        select: {
          requestType: true,
          urgency: true,
          yellowThresholdPercent: true,
        },
      });

      const policyMap = new Map<string, number>();
      for (const p of policies) {
        policyMap.set(
          `${p.requestType}:${p.urgency}`,
          p.yellowThresholdPercent,
        );
      }

      const rows = await tx.requestSla.findMany({
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

      let updated = 0;

      for (const row of rows) {
        const nextStatus = isTerminalRequestStatus(row.request.status)
          ? SlaStatus.ON_TRACK
          : calculateSlaStatus({
              now,
              slaStartAt: row.slaStartAt,
              slaDueAt: row.slaDueAt,
              yellowThresholdPercent:
                policyMap.get(`${row.request.type}:${row.request.urgency}`) ??
                80,
            });

        await tx.requestSla.update({
          where: { requestId: row.requestId },
          data: {
            slaStatus: nextStatus,
            lastCalculatedAt: now,
          },
        });

        updated += 1;
      }

      const summary = await tx.requestSla.groupBy({
        by: ['slaStatus'],
        _count: { _all: true },
      });

      return {
        updated,
        summary,
        calculatedAt: now,
      };
    });
  }

  async summary() {
    const byStatus = await this.prisma.requestSla.groupBy({
      by: ['slaStatus'],
      _count: { _all: true },
    });

    return { byStatus };
  }
}
