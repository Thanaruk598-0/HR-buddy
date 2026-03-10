import { apiFetch } from "@/lib/api/client";

export type RequestType = "BUILDING" | "VEHICLE" | "MESSENGER" | "DOCUMENT";
export type RequestStatus =
  | "NEW"
  | "APPROVED"
  | "IN_PROGRESS"
  | "IN_TRANSIT"
  | "DONE"
  | "REJECTED"
  | "CANCELED";

export type Urgency = "LOW" | "NORMAL" | "HIGH" | "CRITICAL";

export type MyRequestItem = {
  id: string;
  requestNo: string;
  type: RequestType;
  status: RequestStatus;
  urgency: Urgency;
  createdAt: string;
  latestActivityAt: string;
  closedAt: string | null;
};

export type MyRequestsResponse = {
  items: MyRequestItem[];
  page: number;
  limit: number;
  total: number;
};

export type MyRequestsQuery = {
  type?: RequestType;
  status?: RequestStatus;
  q?: string;
  sortBy?: "latestActivityAt" | "createdAt";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
};

export async function getMyRequests(query: MyRequestsQuery = {}) {
  return apiFetch<MyRequestsResponse>("/requests/my", {
    method: "GET",
    tokenType: "employee",
    query,
  });
}
