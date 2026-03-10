import { apiFetch } from "@/lib/api/client";

export type AdminOperator = {
  id: string;
  displayName: string;
  isActive: boolean;
};

export async function getAdminOperators() {
  return apiFetch<{ items: AdminOperator[] }>("/admin/settings/operators", {
    method: "GET",
    tokenType: "admin",
    query: { isActive: true },
  });
}
