import { DeliveryMethod, Prisma } from '@prisma/client';
import { CreateBuildingRequestDto } from '../dto/create-building-request.dto';
import { CreateDocumentRequestDto } from '../dto/create-document-request.dto';
import { CreateMessengerRequestDto } from '../dto/create-messenger-request.dto';
import { CreateVehicleRequestDto } from '../dto/create-vehicle-request.dto';

export type RequestDedupeCandidate = Prisma.RequestGetPayload<{
  include: {
    buildingRepairDetail: true;
    vehicleRepairDetail: true;
    messengerBookingDetail: {
      include: {
        senderAddress: true;
        receiverAddress: true;
      };
    };
    documentRequestDetail: {
      include: {
        deliveryAddress: true;
      };
    };
  };
}>;

type AddressInput = {
  name: string;
  phone: string;
  province: string;
  district: string;
  subdistrict: string;
  postalCode: string;
  houseNo: string;
  soi?: string;
  road?: string;
  extra?: string;
};

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizeOptionalText(value?: string | null) {
  if (!value) {
    return null;
  }

  const normalized = normalizeText(value);
  return normalized.length > 0 ? normalized : null;
}

function normalizePhone(value: string) {
  return value.trim().replace(/\s+/g, '');
}

function normalizeDateTime(value: string | Date) {
  return new Date(value).toISOString();
}

export function normalizeSiteName(raw: string) {
  return normalizeText(raw);
}

function matchesBaseFields(
  candidate: RequestDedupeCandidate,
  dto: {
    employeeName: string;
    departmentId: string;
    departmentOther?: string | null;
    phone: string;
    urgency: string;
  },
) {
  return (
    normalizeText(candidate.employeeName) === normalizeText(dto.employeeName) &&
    candidate.departmentId === dto.departmentId &&
    normalizeOptionalText(candidate.departmentOther) ===
      normalizeOptionalText(dto.departmentOther) &&
    normalizePhone(candidate.phone) === normalizePhone(dto.phone) &&
    candidate.urgency === dto.urgency
  );
}

function equalsAddress(
  input: AddressInput,
  existing?: {
    name: string;
    phone: string;
    province: string;
    district: string;
    subdistrict: string;
    postalCode: string;
    houseNo: string;
    soi: string | null;
    road: string | null;
    extra: string | null;
  } | null,
) {
  if (!existing) {
    return false;
  }

  return (
    normalizeText(existing.name) === normalizeText(input.name) &&
    normalizePhone(existing.phone) === normalizePhone(input.phone) &&
    normalizeText(existing.province) === normalizeText(input.province) &&
    normalizeText(existing.district) === normalizeText(input.district) &&
    normalizeText(existing.subdistrict) === normalizeText(input.subdistrict) &&
    normalizeText(existing.postalCode) === normalizeText(input.postalCode) &&
    normalizeText(existing.houseNo) === normalizeText(input.houseNo) &&
    normalizeOptionalText(existing.soi) === normalizeOptionalText(input.soi) &&
    normalizeOptionalText(existing.road) ===
      normalizeOptionalText(input.road) &&
    normalizeOptionalText(existing.extra) === normalizeOptionalText(input.extra)
  );
}

export function isDuplicateBuildingRequest(
  dto: CreateBuildingRequestDto,
  recentRequests: RequestDedupeCandidate[],
) {
  return recentRequests.some((candidate) => {
    const detail = candidate.buildingRepairDetail;

    if (!detail || !matchesBaseFields(candidate, dto)) {
      return false;
    }

    return (
      detail.building === dto.building &&
      detail.floor === dto.floor &&
      detail.problemCategoryId === dto.problemCategoryId &&
      normalizeText(detail.locationDetail) ===
        normalizeText(dto.locationDetail) &&
      normalizeText(detail.description) === normalizeText(dto.description) &&
      normalizeOptionalText(detail.problemCategoryOther) ===
        normalizeOptionalText(dto.problemCategoryOther) &&
      normalizeOptionalText(detail.additionalDetails) ===
        normalizeOptionalText(dto.additionalDetails)
    );
  });
}

export function isDuplicateVehicleRequest(
  dto: CreateVehicleRequestDto,
  recentRequests: RequestDedupeCandidate[],
) {
  return recentRequests.some((candidate) => {
    const detail = candidate.vehicleRepairDetail;

    if (!detail || !matchesBaseFields(candidate, dto)) {
      return false;
    }

    return (
      normalizeText(detail.vehiclePlate) === normalizeText(dto.vehiclePlate) &&
      detail.issueCategoryId === dto.issueCategoryId &&
      normalizeText(detail.symptom) === normalizeText(dto.symptom) &&
      normalizeOptionalText(detail.issueCategoryOther) ===
        normalizeOptionalText(dto.issueCategoryOther) &&
      normalizeOptionalText(detail.additionalDetails) ===
        normalizeOptionalText(dto.additionalDetails)
    );
  });
}

export function isDuplicateMessengerRequest(
  dto: CreateMessengerRequestDto,
  recentRequests: RequestDedupeCandidate[],
) {
  return recentRequests.some((candidate) => {
    const detail = candidate.messengerBookingDetail;

    if (!detail || !matchesBaseFields(candidate, dto)) {
      return false;
    }

    return (
      normalizeDateTime(detail.pickupDatetime) ===
        normalizeDateTime(dto.pickupDatetime) &&
      detail.itemType === dto.itemType &&
      normalizeText(detail.itemDescription) ===
        normalizeText(dto.itemDescription) &&
      detail.outsideBkkMetro === dto.outsideBkkMetro &&
      (detail.deliveryService ?? null) === (dto.deliveryService ?? null) &&
      normalizeOptionalText(detail.deliveryServiceOther) ===
        normalizeOptionalText(dto.deliveryServiceOther) &&
      equalsAddress(dto.sender, detail.senderAddress) &&
      equalsAddress(dto.receiver, detail.receiverAddress)
    );
  });
}

export function isDuplicateDocumentRequest(
  dto: CreateDocumentRequestDto,
  recentRequests: RequestDedupeCandidate[],
) {
  return recentRequests.some((candidate) => {
    const detail = candidate.documentRequestDetail;

    if (!detail || !matchesBaseFields(candidate, dto)) {
      return false;
    }

    const sameCore =
      normalizeSiteName(detail.siteNameNormalized) ===
        normalizeSiteName(dto.siteNameRaw) &&
      normalizeText(detail.documentDescription) ===
        normalizeText(dto.documentDescription) &&
      normalizeText(detail.purpose) === normalizeText(dto.purpose) &&
      normalizeDateTime(detail.neededDate) ===
        normalizeDateTime(dto.neededDate) &&
      detail.deliveryMethod === dto.deliveryMethod &&
      normalizeOptionalText(detail.note) === normalizeOptionalText(dto.note);

    if (!sameCore) {
      return false;
    }

    if (dto.deliveryMethod !== DeliveryMethod.POSTAL) {
      return !detail.deliveryAddress;
    }

    if (!dto.deliveryAddress) {
      return false;
    }

    return equalsAddress(dto.deliveryAddress, detail.deliveryAddress);
  });
}

