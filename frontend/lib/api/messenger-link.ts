import { apiFetch } from "@/lib/api/client";
import type { RequestStatus, Urgency } from "@/lib/api/my-requests";

export type MessengerAddress = {
  id: string;
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
};

export type MessengerLinkDetail = {
  request: {
    id: string;
    requestNo: string;
    type: "MESSENGER";
    status: RequestStatus;
    urgency: Urgency;
    latestActivityAt: string;
  };
  messengerDetail: {
    pickupDatetime: string;
    itemType: "DOCUMENT" | "PACKAGE";
    itemDescription: string;
    outsideBkkMetro: boolean;
    deliveryService: "POST" | "NAKHONCHAI_AIR" | "OTHER" | null;
    deliveryServiceOther: string | null;
    senderAddress: MessengerAddress;
    receiverAddress: MessengerAddress;
  };
  expiresAt: string;
};

export type MessengerStatusUpdatePayload = {
  status: Extract<RequestStatus, "IN_TRANSIT" | "DONE">;
  note?: string;
};

function tokenHeaders(token: string) {
  return {
    "x-messenger-token": token,
  };
}

export async function getMessengerLink(token: string) {
  return apiFetch<MessengerLinkDetail>("/messenger/link", {
    method: "GET",
    headers: tokenHeaders(token),
  });
}

export async function updateMessengerLinkStatus(token: string, payload: MessengerStatusUpdatePayload) {
  return apiFetch<{ id: string; requestNo: string; status: RequestStatus }>("/messenger/link/status", {
    method: "PATCH",
    headers: tokenHeaders(token),
    body: payload,
  });
}

export async function reportMessengerProblem(token: string, note: string) {
  return apiFetch<{ ok: boolean }>("/messenger/link/report-problem", {
    method: "POST",
    headers: tokenHeaders(token),
    body: { note },
  });
}

export async function sendMessengerPickupEvent(token: string, note?: string) {
  return apiFetch<{ ok: boolean }>("/messenger/link/pickup-event", {
    method: "POST",
    headers: tokenHeaders(token),
    body: note?.trim() ? { note: note.trim() } : {},
  });
}
