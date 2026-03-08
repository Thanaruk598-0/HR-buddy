import { BadRequestException } from '@nestjs/common';
import { DeliveryMethod, RequestStatus } from '@prisma/client';

export function assertDocumentPreconditions(params: {
  toStatus: RequestStatus;
  deliveryMethod: DeliveryMethod;
  deliveryAddressId: string | null;
  digitalFileAttachmentId: string | null;
  pickupNote: string | null;
}) {
  const {
    toStatus,
    deliveryMethod,
    deliveryAddressId,
    digitalFileAttachmentId,
    pickupNote,
  } = params;

  if (
    toStatus === RequestStatus.APPROVED &&
    deliveryMethod === DeliveryMethod.POSTAL &&
    !deliveryAddressId
  ) {
    throw new BadRequestException({
      code: 'DELIVERY_ADDRESS_REQUIRED_BEFORE_APPROVED',
      message:
        'deliveryAddress is required before APPROVED when deliveryMethod is POSTAL',
    });
  }

  if (toStatus !== RequestStatus.DONE) {
    return;
  }

  if (deliveryMethod === DeliveryMethod.POSTAL && !deliveryAddressId) {
    throw new BadRequestException({
      code: 'DELIVERY_ADDRESS_REQUIRED_BEFORE_DONE',
      message:
        'deliveryAddress is required before DONE when deliveryMethod is POSTAL',
    });
  }

  if (deliveryMethod === DeliveryMethod.DIGITAL && !digitalFileAttachmentId) {
    throw new BadRequestException({
      code: 'DIGITAL_FILE_REQUIRED_BEFORE_DONE',
      message:
        'digitalFileAttachmentId is required before DONE when deliveryMethod is DIGITAL',
    });
  }

  if (deliveryMethod === DeliveryMethod.PICKUP && !pickupNote?.trim()) {
    throw new BadRequestException({
      code: 'PICKUP_NOTE_REQUIRED_BEFORE_DONE',
      message:
        'pickupNote is required before DONE when deliveryMethod is PICKUP',
    });
  }
}
