import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { AbuseProtectionService } from './abuse-protection.service';
import {
  RATE_LIMIT_POLICY_KEY,
  RateLimitPolicyConfig,
  RateLimitPolicyName,
} from './rate-limit.types';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
    private readonly abuseProtectionService: AbuseProtectionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return true;
    }

    if (!this.isEnabled()) {
      return true;
    }

    const policy = this.reflector.getAllAndOverride<RateLimitPolicyName>(
      RATE_LIMIT_POLICY_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!policy) {
      return true;
    }

    const cfg = this.policyConfig(policy);

    if (cfg.maxRequests <= 0 || cfg.windowSeconds <= 0) {
      return true;
    }

    const req = context
      .switchToHttp()
      .getRequest<Request & { requestId?: string }>();
    const res = context.switchToHttp().getResponse<Response>();

    const key = this.resolveClientKey(policy, req);

    const result = await this.abuseProtectionService.consume({
      scope: policy,
      key,
      policy: cfg,
    });

    res.setHeader('X-RateLimit-Limit', String(cfg.maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(result.remaining));
    res.setHeader('X-RateLimit-Reset', String(result.resetAtUnix));

    if (result.allowed) {
      return true;
    }

    res.setHeader('Retry-After', String(result.retryAfterSeconds));

    throw new HttpException(
      {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please retry later.',
        policy,
        retryAfterSeconds: result.retryAfterSeconds,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private isEnabled() {
    return this.config.get<boolean>('abuseProtection.enabled') ?? true;
  }

  private policyConfig(policy: RateLimitPolicyName): RateLimitPolicyConfig {
    return {
      windowSeconds:
        this.config.get<number>(
          `abuseProtection.policies.${policy}.windowSeconds`,
        ) ?? 60,
      maxRequests:
        this.config.get<number>(
          `abuseProtection.policies.${policy}.maxRequests`,
        ) ?? 10,
      blockSeconds:
        this.config.get<number>(
          `abuseProtection.policies.${policy}.blockSeconds`,
        ) ?? 0,
    };
  }

  private resolveClientKey(policy: RateLimitPolicyName, req: Request) {
    const ip = this.clientIp(req);
    const body = (req.body ?? {}) as Record<string, unknown>;

    switch (policy) {
      case 'otpSend': {
        const phone = this.normalizeText(body.phone);
        const email = this.normalizeText(body.email)?.toLowerCase();
        return `${ip}:phone=${phone ?? '-'}:email=${email ?? '-'}`;
      }
      case 'otpVerify': {
        const phone = this.normalizeText(body.phone);
        const email = this.normalizeText(body.email)?.toLowerCase();
        return `${ip}:phone=${phone ?? '-'}:email=${email ?? '-'}`;
      }
      case 'adminLogin': {
        const username = this.normalizeText(body.username)?.toLowerCase();
        return `${ip}:username=${username ?? '-'}`;
      }
      case 'requestCreate': {
        const phone = this.normalizeText(body.phone);
        return `${ip}:phone=${phone ?? '-'}:path=${req.path}`;
      }
      default:
        return ip;
    }
  }

  private clientIp(req: Request) {
    const xff = req.headers['x-forwarded-for'];

    if (typeof xff === 'string' && xff.trim()) {
      return xff.split(',')[0].trim();
    }

    return req.ip || req.socket.remoteAddress || 'unknown';
  }

  private normalizeText(value: unknown) {
    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }
}
