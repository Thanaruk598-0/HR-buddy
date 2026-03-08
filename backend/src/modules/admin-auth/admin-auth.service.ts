import { UnauthorizedException } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import {
  issueAdminSessionToken,
  verifyAdminSessionToken,
} from './utils/admin-session-token.util';

@Injectable()
export class AdminAuthService {
  constructor(private readonly config: ConfigService) {}

  login(usernameInput: string, passwordInput: string) {
    const adminUsername =
      this.config.get<string>('adminAuth.username') ?? 'admin';
    const adminPassword =
      this.config.get<string>('adminAuth.password') ?? 'admin12345';

    if (!this.matchCredential(usernameInput, adminUsername)) {
      throw this.invalidCredentialError();
    }

    if (!this.matchCredential(passwordInput, adminPassword)) {
      throw this.invalidCredentialError();
    }

    return issueAdminSessionToken({
      username: adminUsername,
      secret: this.sessionSecret(),
      ttlMinutes: this.sessionTtlMinutes(),
    });
  }

  verifySessionToken(token: string) {
    return verifyAdminSessionToken({
      token,
      secret: this.sessionSecret(),
    });
  }

  private matchCredential(input: string, expected: string) {
    const inputBuffer = Buffer.from(input.trim(), 'utf8');
    const expectedBuffer = Buffer.from(expected, 'utf8');

    if (inputBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(inputBuffer, expectedBuffer);
  }

  private sessionSecret() {
    return (
      this.config.get<string>('adminAuth.sessionSecret') ??
      'dev-only-change-this-admin-session-secret'
    );
  }

  private sessionTtlMinutes() {
    return this.config.get<number>('adminAuth.sessionTtlMinutes') ?? 480;
  }

  private invalidCredentialError() {
    return new UnauthorizedException({
      code: 'INVALID_ADMIN_CREDENTIALS',
      message: 'Invalid admin credentials',
    });
  }
}
