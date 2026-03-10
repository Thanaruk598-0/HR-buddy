import { apiFetch, ApiError } from "@/lib/api/client";
import { getAuthToken } from "@/lib/auth/tokens";

export type AdminRequestType = "BUILDING" | "VEHICLE" | "MESSENGER" | "DOCUMENT";
export type AdminRequestStatus =
  | "NEW"
  | "APPROVED"
  | "IN_PROGRESS"
  | "IN_TRANSIT"
  | "DONE"
  | "REJECTED"
  | "CANCELED";

export type AdminUrgency = "LOW" | "NORMAL" | "HIGH" | "CRITICAL";
export type FileKind = "IMAGE" | "VIDEO" | "DOCUMENT";

export type AdminRequestListItem = {
  id: string;
  requestNo: string;
  type: AdminRequestType;
  status: AdminRequestStatus;
  urgency: AdminUrgency;
  employeeName: string;
  phone: string;
  departmentId: string;
  createdAt: string;
  latestActivityAt: string;
  closedAt: string | null;
};

export type AdminRequestListResponse = {
  items: AdminRequestListItem[];
  page: number;
  limit: number;
  total: number;
};

export type AdminRequestSummaryResponse = {
  total: number;
  byStatus: Record<AdminRequestStatus, number>;
  byType: Record<AdminRequestType, number>;
  byDay: Array<{ date: string; total: number }>;
};

export type AdminRequestListQuery = {
  type?: AdminRequestType;
  status?: AdminRequestStatus;
  dateFrom?: string;
  dateTo?: string;
  q?: string;
  page?: number;
  limit?: number;
};

export type AdminRequestDetail = {
  id: string;
  requestNo: string;
  type: AdminRequestType;
  status: AdminRequestStatus;
  urgency: AdminUrgency;
  employeeName: string;
  phone: string;
  createdAt: string;
  latestActivityAt: string;
  closedAt: string | null;
  cancelReason: string | null;
  hrCloseNote: string | null;
  department: {
    id: string;
    name: string;
  };
  attachments: Array<{
    id: string;
    fileKind: FileKind;
    fileName: string;
    mimeType: string;
    fileSize: number;
    storageKey: string;
    publicUrl: string | null;
    uploadedByRole: string;
    createdAt: string;
  }>;
  activityLogs: Array<{
    id: string;
    action: string;
    fromStatus: AdminRequestStatus | null;
    toStatus: AdminRequestStatus | null;
    note: string | null;
    actorRole: string;
    actorDisplayName: string | null;
    createdAt: string;
    operator: {
      id: string;
      displayName: string;
    } | null;
  }>;
  buildingRepairDetail: {
    building: string;
    floor: number;
    locationDetail: string;
    problemCategoryOther: string | null;
    description: string;
    additionalDetails: string | null;
    problemCategory: {
      id: string;
      name: string;
      helperText: string | null;
    };
  } | null;
  vehicleRepairDetail: {
    vehiclePlate: string;
    issueCategoryOther: string | null;
    symptom: string;
    additionalDetails: string | null;
    issueCategory: {
      id: string;
      name: string;
    };
  } | null;
  messengerBookingDetail: {
    pickupDatetime: string;
    itemType: string;
    itemDescription: string;
    outsideBkkMetro: boolean;
    deliveryService: string | null;
    deliveryServiceOther: string | null;
    senderAddress: {
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
    receiverAddress: {
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
  } | null;
  documentRequestDetail: {
    siteNameRaw: string;
    siteNameNormalized: string;
    documentDescription: string;
    purpose: string;
    neededDate: string;
    deliveryMethod: "DIGITAL" | "POSTAL" | "PICKUP";
    note: string | null;
    pickupNote: string | null;
    digitalFileAttachmentId: string | null;
    deliveryAddress: {
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
    } | null;
    digitalFileAttachment: {
      id: string;
      fileName: string;
      fileKind: FileKind;
    } | null;
  } | null;
};

export type AdminStatusUpdatePayload = {
  status: AdminRequestStatus;
  operatorId: string;
  note?: string;
  pickupNote?: string;
  digitalFileAttachmentId?: string;
};

export type AdminUploadTicketPayload = {
  fileKind: FileKind;
  fileName: string;
  mimeType: string;
  fileSize: number;
};

export type AdminUploadTicketResponse = {
  uploadToken: string;
  storageKey: string;
  uploadUrl: string;
  uploadMethod: "PUT" | "POST";
  uploadHeaders: Record<string, string>;
  expiresAt: string;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:3001";

function toQueryString(query: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === "") {
      return;
    }

    params.set(key, String(value));
  });

  return params.toString();
}

export async function getAdminRequests(query: AdminRequestListQuery = {}) {
  return apiFetch<AdminRequestListResponse>("/admin/requests", {
    method: "GET",
    tokenType: "admin",
    query,
  });
}

export async function getAdminRequestSummary(
  query: Omit<AdminRequestListQuery, "page" | "limit"> = {},
) {
  return apiFetch<AdminRequestSummaryResponse>("/admin/requests/report/summary", {
    method: "GET",
    tokenType: "admin",
    query,
  });
}

export async function getAdminRequestDetail(requestId: string) {
  return apiFetch<AdminRequestDetail>(`/admin/requests/${requestId}`, {
    method: "GET",
    tokenType: "admin",
  });
}

export async function updateAdminRequestStatus(
  requestId: string,
  payload: AdminStatusUpdatePayload,
) {
  return apiFetch<{ id: string; status: AdminRequestStatus; magicLink?: { url: string; expiresAt: string } }>(
    `/admin/requests/${requestId}/status`,
    {
      method: "PATCH",
      tokenType: "admin",
      body: payload,
    },
  );
}

export async function issueAdminAttachmentUploadTicket(
  requestId: string,
  payload: AdminUploadTicketPayload,
) {
  return apiFetch<AdminUploadTicketResponse>(`/admin/requests/${requestId}/attachments/presign`, {
    method: "POST",
    tokenType: "admin",
    body: payload,
  });
}

export async function completeAdminAttachmentUpload(requestId: string, uploadToken: string) {
  return apiFetch<{ id: string }>(`/admin/requests/${requestId}/attachments/complete`, {
    method: "POST",
    tokenType: "admin",
    body: { uploadToken },
  });
}

export async function getAdminAttachmentDownloadUrl(requestId: string, attachmentId: string) {
  return apiFetch<{
    attachmentId: string;
    fileName: string;
    fileKind: FileKind;
    mimeType: string;
    fileSize: number;
    downloadUrl: string;
    expiresAt: string;
  }>(`/admin/requests/${requestId}/attachments/${attachmentId}/download-url`, {
    method: "GET",
    tokenType: "admin",
  });
}

export async function uploadFileToPresignedUrl(
  uploadTicket: AdminUploadTicketResponse,
  file: File,
) {
  const headers = new Headers(uploadTicket.uploadHeaders ?? {});

  if (!headers.has("Content-Type") && file.type) {
    headers.set("Content-Type", file.type);
  }

  const response = await fetch(uploadTicket.uploadUrl, {
    method: uploadTicket.uploadMethod,
    headers,
    body: file,
  });

  if (!response.ok) {
    throw new ApiError(response.status, null, `Upload failed (${response.status})`);
  }
}

export async function downloadAdminRequestsCsv(
  query: Omit<AdminRequestListQuery, "page"> = {},
): Promise<{ fileName: string; csv: string }> {
  const token = getAuthToken("admin");

  if (!token) {
    throw new ApiError(401, null, "Admin session token is missing");
  }

  const queryString = toQueryString({
    type: query.type,
    status: query.status,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    q: query.q,
    limit: query.limit,
  });

  const response = await fetch(`${API_BASE_URL}/admin/requests/export/csv${queryString ? `?${queryString}` : ""}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "text/csv",
    },
  });

  if (!response.ok) {
    let message = `Failed to export csv (${response.status})`;

    try {
      const body = (await response.json()) as { message?: string | string[] };
      if (Array.isArray(body.message)) {
        message = body.message.join(", ");
      } else if (typeof body.message === "string") {
        message = body.message;
      }
    } catch {
      // noop
    }

    throw new ApiError(response.status, null, message);
  }

  const disposition = response.headers.get("content-disposition") ?? "";
  const match = disposition.match(/filename="([^"]+)"/i);
  const fileName = match?.[1] ?? "requests-export.csv";

  return {
    fileName,
    csv: await response.text(),
  };
}
