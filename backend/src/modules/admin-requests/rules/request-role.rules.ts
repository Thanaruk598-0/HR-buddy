import { ForbiddenException } from '@nestjs/common';
import { ActorRole, RequestStatus } from '@prisma/client';

export function assertRoleCanChangeStatus(role: ActorRole, to: RequestStatus) {
  if (role === 'ADMIN') return;

  if (role === 'EMPLOYEE' && to === 'CANCELED') return;

  throw new ForbiddenException({
    code: 'ROLE_NOT_ALLOWED',
    message: `Role ${role} cannot change status to ${to}`,
  });
}
