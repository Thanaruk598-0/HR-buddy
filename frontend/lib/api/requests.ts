import { apiFetch } from "@/lib/api/client";

export type Urgency = "LOW" | "NORMAL" | "HIGH" | "CRITICAL";
export type BuildingSide = "FRONT" | "BACK";
export type ItemType = "DOCUMENT" | "PACKAGE";
export type DeliveryService = "POST" | "NAKHONCHAI_AIR" | "OTHER";
export type DeliveryMethod = "DIGITAL" | "POSTAL" | "PICKUP";

export type AddressPayload = {
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

export type CreateBuildingRequestPayload = {
  employeeName: string;
  departmentId: string;
  departmentOther?: string;
  phone: string;
  urgency: Urgency;
  building: BuildingSide;
  floor: number;
  locationDetail: string;
  problemCategoryId: string;
  problemCategoryOther?: string;
  description: string;
  additionalDetails?: string;
};

export type CreateVehicleRequestPayload = {
  employeeName: string;
  departmentId: string;
  departmentOther?: string;
  phone: string;
  urgency: Urgency;
  vehiclePlate: string;
  issueCategoryId: string;
  issueCategoryOther?: string;
  symptom: string;
  additionalDetails?: string;
};

export type CreateMessengerRequestPayload = {
  employeeName: string;
  departmentId: string;
  departmentOther?: string;
  phone: string;
  urgency: Urgency;
  pickupDatetime: string;
  itemType: ItemType;
  itemDescription: string;
  outsideBkkMetro: boolean;
  deliveryService?: DeliveryService;
  deliveryServiceOther?: string;
  sender: AddressPayload;
  receiver: AddressPayload;
};

export type CreateDocumentRequestPayload = {
  employeeName: string;
  departmentId: string;
  departmentOther?: string;
  phone: string;
  urgency: Urgency;
  siteNameRaw: string;
  documentDescription: string;
  purpose: string;
  neededDate: string;
  deliveryMethod: DeliveryMethod;
  note?: string;
  deliveryAddress?: AddressPayload;
};

export type CreateRequestResponse = {
  id: string;
  requestNo: string;
  status: string;
};

export async function createBuildingRequest(payload: CreateBuildingRequestPayload) {
  return apiFetch<CreateRequestResponse>("/requests/building", {
    method: "POST",
    body: payload,
  });
}

export async function createVehicleRequest(payload: CreateVehicleRequestPayload) {
  return apiFetch<CreateRequestResponse>("/requests/vehicle", {
    method: "POST",
    body: payload,
  });
}

export async function createMessengerRequest(payload: CreateMessengerRequestPayload) {
  return apiFetch<CreateRequestResponse>("/requests/messenger", {
    method: "POST",
    body: payload,
  });
}

export async function createDocumentRequest(payload: CreateDocumentRequestPayload) {
  return apiFetch<CreateRequestResponse>("/requests/document", {
    method: "POST",
    body: payload,
  });
}
