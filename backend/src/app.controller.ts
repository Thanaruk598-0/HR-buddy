import {
  Controller,
  Get,
  Headers,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ReadinessReport, ReadinessService } from './health/readiness.service';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly readinessService: ReadinessService,
    private readonly config: ConfigService,
  ) {}

  @Get('health')
  health() {
    return { ok: true };
  }

  @Get('health/db')
  async healthDb(@Headers('x-health-token') healthToken?: string) {
    this.assertHealthAccess(healthToken);

    // Lightweight query to verify active DB connection
    await this.prisma.$queryRaw`SELECT 1`;
    return { ok: true, db: true };
  }

  @Get('health/ready')
  async healthReady(@Headers('x-health-token') healthToken?: string) {
    this.assertHealthAccess(healthToken);

    const report = await this.readinessService.getReport();
    const response = this.formatReadinessResponse(report);

    if (!report.ok) {
      throw new ServiceUnavailableException(response);
    }

    return response;
  }

  private formatReadinessResponse(report: ReadinessReport) {
    if (!this.isProduction()) {
      return report;
    }

    return {
      ok: report.ok,
      checkedAt: report.checkedAt,
      checks: report.checks.map((check) => ({
        name: check.name,
        ok: check.ok,
        skipped: check.skipped,
      })),
    };
  }

  private assertHealthAccess(healthTokenHeader?: string) {
    if (!this.isProduction()) {
      return;
    }

    const expectedToken =
      this.config.get<string>('health.checkToken')?.trim() ?? '';

    // Guard should already prevent boot without this, keep runtime defense-in-depth.
    if (!expectedToken) {
      throw new ServiceUnavailableException({
        code: 'HEALTH_ENDPOINT_NOT_CONFIGURED',
        message: 'Health endpoint token is not configured',
      });
    }

    const providedToken = healthTokenHeader?.trim() ?? '';

    if (providedToken !== expectedToken) {
      throw new UnauthorizedException({
        code: 'HEALTH_TOKEN_INVALID',
        message: 'Invalid health endpoint token',
      });
    }
  }

  private isProduction() {
    return (
      (
        this.config.get<string>('runtimeEnv') ??
        this.config.get<string>('nodeEnv') ??
        ''
      ).toLowerCase() === 'production'
    );
  }
}
