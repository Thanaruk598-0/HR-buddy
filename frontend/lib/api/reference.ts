import { apiFetch } from "@/lib/api/client";

export type ReferenceListItem = {
  id: string;
  name: string;
  isActive: boolean;
  helperText?: string;
};

type ReferenceListResponse = {
  items: ReferenceListItem[];
};

export async function getDepartments() {
  return apiFetch<ReferenceListResponse>("/reference/departments", {
    method: "GET",
    query: { isActive: true },
  });
}

export async function getProblemCategories() {
  return apiFetch<ReferenceListResponse>("/reference/problem-categories", {
    method: "GET",
    query: { isActive: true },
  });
}

export async function getVehicleIssueCategories() {
  return apiFetch<ReferenceListResponse>("/reference/vehicle-issue-categories", {
    method: "GET",
    query: { isActive: true },
  });
}
