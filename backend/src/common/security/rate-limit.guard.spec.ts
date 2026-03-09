import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { AbuseProtectionService } from './abuse-protection.service';
import { RateLimitGuard } from './rate-limit.guard';
import { RateLimitPolicyName } from './rate-limit.types';

describe('RateLimitGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn<RateLimitPolicyName | undefined, unknown[]>(),
  } as unknown as Reflector;

  const configValues: Record<string, unknown> = {
    'abuseProtection.enabled': true,
    'abuseProtection.policies.otpSend.windowSeconds': 60,
    'abuseProtection.policies.otpSend.maxRequests': 5,
    'abuseProtection.policies.otpSend.blockSeconds': 300,
  };

  const config = {
    get: jest.fn((key: string) => configValues[key]),
  } as unknown as ConfigService;

  const abuseProtectionService = {
    consume: jest.fn(),
  } as unknown as AbuseProtectionService;

  let guard: RateLimitGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    reflector.getAllAndOverride = jest.fn().mockReturnValue('otpSend');
    (abuseProtectionService.consume as jest.Mock).mockResolvedValue({
      allowed: true,
      remaining: 4,
      retryAfterSeconds: 0,
      resetAtUnix: Math.floor(Date.now() / 1000) + 60,
    });

    guard = new RateLimitGuard(reflector, config, abuseProtectionService);
  });

  it('does not trust raw x-forwarded-for header for client identity', async () => {
    const req = {
      body: { phone: '+66811111111', email: 'employee@cl.local' },
      headers: { 'x-forwarded-for': '198.51.100.25' },
      ip: '10.1.1.10',
      ips: [],
      path: '/auth/otp/send',
      method: 'POST',
      socket: { remoteAddress: '10.1.1.10' },
    } as never;

    const res = {
      setHeader: jest.fn(),
      statusCode: 200,
    } as never;

    const context = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    const allowed = await guard.canActivate(context);

    expect(allowed).toBe(true);
    expect(abuseProtectionService.consume).toHaveBeenCalledWith(
      expect.objectContaining({
        key: expect.stringContaining('10.1.1.10'),
      }),
    );
    expect(abuseProtectionService.consume).not.toHaveBeenCalledWith(
      expect.objectContaining({
        key: expect.stringContaining('198.51.100.25'),
      }),
    );
  });

  it('uses trusted proxy ip chain from req.ips when available', async () => {
    const req = {
      body: { phone: '+66811111111', email: 'employee@cl.local' },
      headers: { 'x-forwarded-for': '198.51.100.25' },
      ip: '10.1.1.10',
      ips: ['203.0.113.11', '10.1.1.10'],
      path: '/auth/otp/send',
      method: 'POST',
      socket: { remoteAddress: '10.1.1.10' },
    } as never;

    const res = {
      setHeader: jest.fn(),
      statusCode: 200,
    } as never;

    const context = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    const allowed = await guard.canActivate(context);

    expect(allowed).toBe(true);
    expect(abuseProtectionService.consume).toHaveBeenCalledWith(
      expect.objectContaining({
        key: expect.stringContaining('203.0.113.11'),
      }),
    );
  });

  it('uses messenger token fingerprint in rate limit key', async () => {
    reflector.getAllAndOverride = jest.fn().mockReturnValue('messengerLink');

    const req = {
      body: {},
      headers: {
        'x-forwarded-for': '198.51.100.25',
        'x-messenger-token': 'sensitive-token',
      },
      method: 'PATCH',
      ip: '10.1.1.10',
      ips: ['203.0.113.11', '10.1.1.10'],
      path: '/messenger/link/status',
      socket: { remoteAddress: '10.1.1.10' },
    } as never;

    const res = {
      setHeader: jest.fn(),
      statusCode: 200,
    } as never;

    const context = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    const allowed = await guard.canActivate(context);

    expect(allowed).toBe(true);
    expect(abuseProtectionService.consume).toHaveBeenCalledWith(
      expect.objectContaining({
        key: '203.0.113.11:method=PATCH:token=a83d19d08d3c3f53:messenger-link',
      }),
    );
    expect(abuseProtectionService.consume).not.toHaveBeenCalledWith(
      expect.objectContaining({
        key: expect.stringContaining('sensitive-token'),
      }),
    );
  });
});
