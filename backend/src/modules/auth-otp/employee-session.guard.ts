import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthOtpService } from './auth-otp.service';

@Injectable()
export class EmployeeSessionGuard implements CanActivate {
  constructor(private readonly authOtpService: AuthOtpService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const token = this.extractToken(
      request.headers?.authorization,
      request.headers?.['x-employee-session-token'],
    );

    if (!token) {
      throw new UnauthorizedException({
        code: 'SESSION_TOKEN_REQUIRED',
        message: 'Missing session token',
      });
    }

    const session = await this.authOtpService.validateSessionToken(token);

    if (!session) {
      throw new UnauthorizedException({
        code: 'INVALID_OR_EXPIRED_SESSION',
        message: 'Invalid or expired session token',
      });
    }

    request.employeeSession = {
      sessionId: session.id,
      phone: session.phone,
      email: session.email,
      expiresAt: session.expiresAt,
    };

    return true;
  }

  private extractToken(
    authorization?: string,
    headerToken?: string | string[],
  ): string | null {
    if (authorization?.startsWith('Bearer ')) {
      const token = authorization.slice('Bearer '.length).trim();
      return token.length > 0 ? token : null;
    }

    if (typeof headerToken === 'string') {
      const token = headerToken.trim();
      return token.length > 0 ? token : null;
    }

    return null;
  }
}
