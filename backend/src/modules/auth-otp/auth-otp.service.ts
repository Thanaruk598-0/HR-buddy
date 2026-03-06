import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import {
  generateOtpCode,
  generateSessionToken,
  hashWithSecret,
} from './utils/crypto.util';

@Injectable()
export class AuthOtpService {
  private readonly otpTtlMinutes = 5;
  private readonly sessionTtlMinutes = 30;
  private readonly maxAttempts = 5;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async sendOtp(dto: SendOtpDto) {
    const normalizedEmail = this.normalizeEmail(dto.email);
    const otpCode = generateOtpCode(6);
    const otpCodeHash = this.hash(otpCode);
    const expiresAt = this.minutesFromNow(this.otpTtlMinutes);

    await this.prisma.otpSession.create({
      data: {
        phone: dto.phone,
        email: normalizedEmail,
        otpCodeHash,
        expiresAt,
      },
    });

    return {
      expiresAt,
      ...(this.isDevMode() ? { devOtp: otpCode } : {}),
    };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const normalizedEmail = this.normalizeEmail(dto.email);

    const otpSession = await this.prisma.otpSession.findFirst({
      where: {
        phone: dto.phone,
        email: normalizedEmail,
        verifiedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpSession) {
      throw new NotFoundException({
        code: 'OTP_SESSION_NOT_FOUND',
        message: 'OTP session not found',
      });
    }

    const now = new Date();

    if (otpSession.expiresAt <= now) {
      throw new BadRequestException({
        code: 'OTP_EXPIRED',
        message: 'OTP is expired',
      });
    }

    if (otpSession.attemptCount >= this.maxAttempts) {
      throw new BadRequestException({
        code: 'OTP_ATTEMPTS_EXCEEDED',
        message: 'Too many OTP attempts',
      });
    }

    const inputHash = this.hash(dto.otpCode);

    if (inputHash !== otpSession.otpCodeHash) {
      await this.prisma.otpSession.update({
        where: { id: otpSession.id },
        data: { attemptCount: { increment: 1 } },
      });

      throw new BadRequestException({
        code: 'INVALID_OTP_CODE',
        message: 'Invalid OTP code',
      });
    }

    await this.prisma.otpSession.update({
      where: { id: otpSession.id },
      data: {
        verifiedAt: now,
        attemptCount: { increment: 1 },
      },
    });

    const sessionToken = generateSessionToken();
    const sessionTokenHash = this.hash(sessionToken);
    const expiresAt = this.minutesFromNow(this.sessionTtlMinutes);

    await this.prisma.employeeAccessSession.create({
      data: {
        phone: dto.phone,
        email: normalizedEmail,
        sessionTokenHash,
        expiresAt,
      },
    });

    return {
      sessionToken,
      expiresAt,
    };
  }

  async validateSessionToken(token: string) {
    return this.prisma.employeeAccessSession.findFirst({
      where: {
        sessionTokenHash: this.hash(token),
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        phone: true,
        email: true,
        expiresAt: true,
      },
    });
  }

  private hash(raw: string) {
    const secret = this.config.get<string>('otpHashSecret') ?? 'dev-otp-secret';
    return hashWithSecret(raw, secret);
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private minutesFromNow(minutes: number) {
    return new Date(Date.now() + minutes * 60_000);
  }

  private isDevMode() {
    return process.env.NODE_ENV !== 'production';
  }
}