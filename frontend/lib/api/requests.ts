import { apiFetch } from "@/lib/api/client";

export type Urgency = "LOW" | "NORMAL" | "HIGH" | "CRITICAL";
export type BuildingSide = "FRONT" | "BACK";

export type CreateBuildingRequestPayload = {
  employeeName: string;
  departmentId: string;
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
  phone: string;
  urgency: Urgency;
  vehiclePlate: string;
  issueCategoryId: string;
  issueCategoryOther?: string;
  symptom: string;
  additionalDetails?: string;
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
