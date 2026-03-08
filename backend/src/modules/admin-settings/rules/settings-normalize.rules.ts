import { BadRequestException } from '@nestjs/common';

export function normalizeRequiredName(value: string, field = 'name'): string {
  const normalized = value.trim().replace(/\s+/g, ' ');

  if (!normalized) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: `${field} is required`,
      field,
    });
  }

  return normalized;
}

export function normalizeOptionalText(
  value?: string,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim().replace(/\s+/g, ' ');

  if (!normalized) {
    return null;
  }

  return normalized;
}

export function normalizeOptionalSearch(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function assertPatchFields(payload: object, fields: string[]): void {
  const record = payload as Record<string, unknown>;
  const hasAny = fields.some((field) => record[field] !== undefined);

  if (!hasAny) {
    throw new BadRequestException({
      code: 'NO_UPDATE_FIELDS',
      message: 'At least one updatable field is required',
    });
  }
}
