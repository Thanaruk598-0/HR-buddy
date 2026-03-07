import { BadRequestException } from '@nestjs/common';
import {
  assertPatchFields,
  normalizeOptionalSearch,
  normalizeOptionalText,
  normalizeRequiredName,
} from './settings-normalize.rules';

describe('settings-normalize.rules', () => {
  it('normalizes required names and compresses spaces', () => {
    expect(normalizeRequiredName('  Alpha   Team  ')).toBe('Alpha Team');
  });

  it('throws on empty required name', () => {
    expect(() => normalizeRequiredName('   ')).toThrow(BadRequestException);
  });

  it('normalizes optional text and turns blank into null', () => {
    expect(normalizeOptionalText('  hello   world ')).toBe('hello world');
    expect(normalizeOptionalText('   ')).toBeNull();
    expect(normalizeOptionalText(undefined)).toBeUndefined();
  });

  it('normalizes optional search', () => {
    expect(normalizeOptionalSearch('  abc ')).toBe('abc');
    expect(normalizeOptionalSearch('   ')).toBeUndefined();
  });

  it('requires at least one patch field', () => {
    expect(() => assertPatchFields({}, ['name', 'isActive'])).toThrow(
      BadRequestException,
    );
    expect(() =>
      assertPatchFields({ name: 'ok' }, ['name', 'isActive']),
    ).not.toThrow();
  });
});
