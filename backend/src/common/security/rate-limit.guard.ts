import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { createHash } from 'crypto';
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
    const body = this.bodyRecord(req.body);

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
      case 'messengerLink': {
        const messengerToken = this.extractMessengerToken(req);
        const tokenFingerprint = messengerToken
          ? this.hashForRateLimitKey(messengerToken)
          : '-';
        return `${ip}:method=${req.method}:token=${tokenFingerprint}:messenger-link`;
      }
      default:
        return ip;
    }
  }

  private clientIp(req: Request) {
    if (Array.isArray(req.ips) && req.ips.length > 0) {
      return req.ips[0];
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

  private extractMessengerToken(req: Request) {
    const headers = req.headers as Record<string, unknown>;
    const authorization = this.firstHeaderValue(headers['authorization']);

    if (authorization?.startsWith('Bearer ')) {
      const token = authorization.slice('Bearer '.length).trim();

      if (token) {
        return token;
      }
    }

    const headerToken = this.firstHeaderValue(headers['x-messenger-token']);

    if (!headerToken) {
      return null;
    }

    const normalized = headerToken.trim();
    return normalized || null;
  }

  private firstHeaderValue(value: unknown): string | null {
    if (typeof value === 'string') {
      return value;
    }

    if (Array.isArray(value)) {
      const values: unknown[] = value;
      const first = values[0];
      return typeof first === 'string' ? first : null;
    }

    return null;
  }

  private hashForRateLimitKey(value: string) {
    return createHash('sha256').update(value).digest('hex').slice(0, 16);
  }

  private bodyRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, unknown>;
  }
}
