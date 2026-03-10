import { apiFetch } from "@/lib/api/client";

export async function getGeoProvinces() {
  return apiFetch<string[]>("/geo/provinces", {
    method: "GET",
  });
}

export async function getGeoDistricts(province: string) {
  return apiFetch<string[]>("/geo/districts", {
    method: "GET",
    query: { province },
  });
}

export async function getGeoSubdistricts(province: string, district: string) {
  return apiFetch<string[]>("/geo/subdistricts", {
    method: "GET",
    query: { province, district },
  });
}

export async function getGeoPostalCode(
  province: string,
  district: string,
  subdistrict: string,
) {
  return apiFetch<{ postalCode: string | null }>("/geo/postal-code", {
    method: "GET",
    query: { province, district, subdistrict },
  });
}
