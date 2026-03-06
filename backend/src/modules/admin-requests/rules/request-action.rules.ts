import { BadRequestException } from '@nestjs/common';
import { RequestStatus } from '@prisma/client';

const NOTE_REQUIRED_STATUSES: RequestStatus[] = [
  RequestStatus.REJECTED,
  RequestStatus.CANCELED,
];

const TERMINAL_STATUSES: RequestStatus[] = [
  RequestStatus.DONE,
  RequestStatus.REJECTED,
  RequestStatus.CANCELED,
];

export function normalizeNote(note?: string): string | null {
  if (note === undefined) {
    return null;
  }

  const trimmed = note.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function assertActionNoteRule(status: RequestStatus, note: string | null) {
  if (NOTE_REQUIRED_STATUSES.includes(status) && !note) {
    throw new BadRequestException({
      code: 'NOTE_REQUIRED_FOR_ACTION',
      message: `note is required when status is ${status}`,
    });
  }
}

export function isTerminalStatus(status: RequestStatus) {
  return TERMINAL_STATUSES.includes(status);
}