import { BadRequestException } from '@nestjs/common';
import { RequestStatus } from '@prisma/client';
import {
  assertActionNoteRule,
  isTerminalStatus,
  normalizeNote,
} from './request-action.rules';

describe('request-action.rules', () => {
  describe('normalizeNote', () => {
    it('returns null for undefined or blank', () => {
      expect(normalizeNote(undefined)).toBeNull();
      expect(normalizeNote('   ')).toBeNull();
    });

    it('returns trimmed text', () => {
      expect(normalizeNote('  hello  ')).toBe('hello');
    });
  });

  describe('assertActionNoteRule', () => {
    it.each<RequestStatus>(['REJECTED', 'CANCELED'])(
      'requires note for %s',
      (status) => {
        expect(() => assertActionNoteRule(status, null)).toThrow(
          BadRequestException,
        );
      },
    );

    it('allows DONE without note', () => {
      expect(() => assertActionNoteRule('DONE', null)).not.toThrow();
    });

    it.each<RequestStatus>(['REJECTED', 'CANCELED', 'DONE'])(
      'allows %s with note',
      (status) => {
        expect(() => assertActionNoteRule(status, 'ok')).not.toThrow();
      },
    );
  });

  describe('isTerminalStatus', () => {
    it.each<RequestStatus>(['DONE', 'REJECTED', 'CANCELED'])(
      'returns true for %s',
      (status) => {
        expect(isTerminalStatus(status)).toBe(true);
      },
    );

    it.each<RequestStatus>(['NEW', 'APPROVED', 'IN_PROGRESS', 'IN_TRANSIT'])(
      'returns false for %s',
      (status) => {
        expect(isTerminalStatus(status)).toBe(false);
      },
    );
  });
});
