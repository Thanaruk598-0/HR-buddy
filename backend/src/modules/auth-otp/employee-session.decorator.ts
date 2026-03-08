import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { EmployeeSessionPrincipal } from './employee-session.types';

export const EmployeeSession = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): EmployeeSessionPrincipal => {
    const request = ctx.switchToHttp().getRequest();
    return request.employeeSession as EmployeeSessionPrincipal;
  },
);
