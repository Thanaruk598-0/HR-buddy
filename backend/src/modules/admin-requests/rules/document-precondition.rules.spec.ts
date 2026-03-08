import { BadRequestException } from '@nestjs/common';
import { DeliveryMethod, RequestStatus } from '@prisma/client';
import { assertDocumentPreconditions } from './document-precondition.rules';

describe('assertDocumentPreconditions', () => {
  it('allows APPROVED for POSTAL when delivery address exists', () => {
    expect(() =>
      assertDocumentPreconditions({
        toStatus: RequestStatus.APPROVED,
        deliveryMethod: DeliveryMethod.POSTAL,
        deliveryAddressId: 'addr_1',
        digitalFileAttachmentId: null,
        pickupNote: null,
      }),
    ).not.toThrow();
  });

  it('rejects APPROVED for POSTAL when delivery address is missing', () => {
    expect(() =>
      assertDocumentPreconditions({
        toStatus: RequestStatus.APPROVED,
        deliveryMethod: DeliveryMethod.POSTAL,
        deliveryAddressId: null,
        digitalFileAttachmentId: null,
        pickupNote: null,
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects DONE for DIGITAL when digital file is missing', () => {
    expect(() =>
      assertDocumentPreconditions({
        toStatus: RequestStatus.DONE,
        deliveryMethod: DeliveryMethod.DIGITAL,
        deliveryAddressId: null,
        digitalFileAttachmentId: null,
        pickupNote: null,
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects DONE for PICKUP when pickup note is missing', () => {
    expect(() =>
      assertDocumentPreconditions({
        toStatus: RequestStatus.DONE,
        deliveryMethod: DeliveryMethod.PICKUP,
        deliveryAddressId: null,
        digitalFileAttachmentId: null,
        pickupNote: '   ',
      }),
    ).toThrow(BadRequestException);
  });

  it('allows DONE for DIGITAL when digital file exists', () => {
    expect(() =>
      assertDocumentPreconditions({
        toStatus: RequestStatus.DONE,
        deliveryMethod: DeliveryMethod.DIGITAL,
        deliveryAddressId: null,
        digitalFileAttachmentId: 'att_1',
        pickupNote: null,
      }),
    ).not.toThrow();
  });

  it('allows DONE for PICKUP when pickup note exists', () => {
    expect(() =>
      assertDocumentPreconditions({
        toStatus: RequestStatus.DONE,
        deliveryMethod: DeliveryMethod.PICKUP,
        deliveryAddressId: null,
        digitalFileAttachmentId: null,
        pickupNote: 'รับที่สำนักงานใหญ่ 15:00',
      }),
    ).not.toThrow();
  });
});
