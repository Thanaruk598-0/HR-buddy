import { apiFetch } from "@/lib/api/client";

export type NotificationEventType =
  | "APPROVED"
  | "REJECTED"
  | "DONE"
  | "CANCELED"
  | "MESSENGER_BOOKED"
  | "PROBLEM_REPORTED";

export type NotificationItem = {
  id: string;
  requestId: string | null;
  eventType: NotificationEventType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
};

export type NotificationListResponse = {
  items: NotificationItem[];
  page: number;
  limit: number;
  total: number;
};

export async function getMyNotifications(limit = 20) {
  return apiFetch<NotificationListResponse>("/notifications/my", {
    method: "GET",
    tokenType: "employee",
    query: { limit },
  });
}

export async function markMyNotificationRead(id: string) {
  return apiFetch<{ ok: boolean }>(`/notifications/my/${id}/read`, {
    method: "PATCH",
    tokenType: "employee",
  });
}

export async function markMyNotificationsReadAll() {
  return apiFetch<{ updated: number }>("/notifications/my/read-all", {
    method: "PATCH",
    tokenType: "employee",
  });
}
