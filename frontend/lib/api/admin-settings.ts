import { apiFetch } from "@/lib/api/client";

export type AdminSettingsQuery = {
  isActive?: boolean;
  q?: string;
};

export type AdminDepartment = {
  id: string;
  name: string;
  isActive: boolean;
};

export type AdminProblemCategory = {
  id: string;
  name: string;
  helperText: string | null;
  isActive: boolean;
};

export type AdminVehicleIssueCategory = {
  id: string;
  name: string;
  isActive: boolean;
};

export type AdminOperator = {
  id: string;
  displayName: string;
  isActive: boolean;
  createdAt?: string;
};

export async function listAdminDepartments(query: AdminSettingsQuery = {}) {
  return apiFetch<{ items: AdminDepartment[] }>("/admin/settings/departments", {
    method: "GET",
    tokenType: "admin",
    query,
  });
}

export async function createAdminDepartment(payload: { name: string; isActive?: boolean }) {
  return apiFetch<AdminDepartment>("/admin/settings/departments", {
    method: "POST",
    tokenType: "admin",
    body: payload,
  });
}

export async function updateAdminDepartment(
  id: string,
  payload: { name?: string; isActive?: boolean },
) {
  return apiFetch<AdminDepartment>(`/admin/settings/departments/${id}`, {
    method: "PATCH",
    tokenType: "admin",
    body: payload,
  });
}

export async function listAdminProblemCategories(query: AdminSettingsQuery = {}) {
  return apiFetch<{ items: AdminProblemCategory[] }>("/admin/settings/problem-categories", {
    method: "GET",
    tokenType: "admin",
    query,
  });
}

export async function createAdminProblemCategory(payload: {
  name: string;
  helperText?: string;
  isActive?: boolean;
}) {
  return apiFetch<AdminProblemCategory>("/admin/settings/problem-categories", {
    method: "POST",
    tokenType: "admin",
    body: payload,
  });
}

export async function updateAdminProblemCategory(
  id: string,
  payload: { name?: string; helperText?: string; isActive?: boolean },
) {
  return apiFetch<AdminProblemCategory>(`/admin/settings/problem-categories/${id}`, {
    method: "PATCH",
    tokenType: "admin",
    body: payload,
  });
}

export async function listAdminVehicleIssueCategories(query: AdminSettingsQuery = {}) {
  return apiFetch<{ items: AdminVehicleIssueCategory[] }>("/admin/settings/vehicle-issue-categories", {
    method: "GET",
    tokenType: "admin",
    query,
  });
}

export async function createAdminVehicleIssueCategory(payload: {
  name: string;
  isActive?: boolean;
}) {
  return apiFetch<AdminVehicleIssueCategory>("/admin/settings/vehicle-issue-categories", {
    method: "POST",
    tokenType: "admin",
    body: payload,
  });
}

export async function updateAdminVehicleIssueCategory(
  id: string,
  payload: { name?: string; isActive?: boolean },
) {
  return apiFetch<AdminVehicleIssueCategory>(`/admin/settings/vehicle-issue-categories/${id}`, {
    method: "PATCH",
    tokenType: "admin",
    body: payload,
  });
}

export async function listAdminOperators(query: AdminSettingsQuery = {}) {
  return apiFetch<{ items: AdminOperator[] }>("/admin/settings/operators", {
    method: "GET",
    tokenType: "admin",
    query,
  });
}

export async function createAdminOperator(payload: {
  displayName: string;
  isActive?: boolean;
}) {
  return apiFetch<AdminOperator>("/admin/settings/operators", {
    method: "POST",
    tokenType: "admin",
    body: payload,
  });
}

export async function updateAdminOperator(
  id: string,
  payload: { displayName?: string; isActive?: boolean },
) {
  return apiFetch<AdminOperator>(`/admin/settings/operators/${id}`, {
    method: "PATCH",
    tokenType: "admin",
    body: payload,
  });
}

export async function getAdminOperators() {
  return listAdminOperators({ isActive: true });
}
