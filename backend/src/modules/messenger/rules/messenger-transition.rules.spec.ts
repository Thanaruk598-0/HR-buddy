import { BadRequestException } from '@nestjs/common';
import { RequestStatus } from '@prisma/client';
import {
  assertMessengerTargetStatus,
  assertMessengerTransition,
} from './messenger-transition.rules';

describe('assertMessengerTransition', () => {
  it.each<[RequestStatus, RequestStatus]>([
    ['APPROVED', 'IN_TRANSIT'],
    ['IN_TRANSIT', 'DONE'],
  ])('allows %s -> %s', (from, to) => {
    expect(() => assertMessengerTransition(from, to)).not.toThrow();
  });

  it.each<[RequestStatus, RequestStatus]>([
    ['APPROVED', 'DONE'],
    ['NEW', 'IN_TRANSIT'],
    ['DONE', 'IN_TRANSIT'],
    ['IN_TRANSIT', 'CANCELED'],
  ])('rejects %s -> %s', (from, to) => {
    expect(() => assertMessengerTransition(from, to)).toThrow(
      BadRequestException,
    );
  });
});

describe('assertMessengerTargetStatus', () => {
  it.each<RequestStatus>(['IN_TRANSIT', 'DONE'])(
    'allows target status %s',
    (status) => {
      expect(() => assertMessengerTargetStatus(status)).not.toThrow();
    },
  );

  it.each<RequestStatus>([
    'NEW',
    'APPROVED',
    'IN_PROGRESS',
    'REJECTED',
    'CANCELED',
  ])('rejects target status %s', (status) => {
    expect(() => assertMessengerTargetStatus(status)).toThrow(
      BadRequestException,
    );
  });
});
