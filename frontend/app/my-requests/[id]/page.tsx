"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { RouteGuard } from "@/components/guards/route-guard";
import { Button, SelectField, TextareaField } from "@/components/ui/form-controls";
import { VideoPreviewModal } from "@/components/ui/video-preview-modal";
import { downloadFileFromPresignedUrl } from "@/lib/attachments/download";
import { getDocumentTypeLabel } from "@/lib/attachments/document-type-label";
import { ApiError } from "@/lib/api/client";
import {
  getAcceptMimeTypes,
  getAttachmentPolicySummary,
  inferFileKindFromMimeType,
  resolveUploadMimeType,
  validateAttachmentCandidate,
} from "@/lib/attachments/attachment-policy";
import {
  cancelMyRequest,
  completeMyAttachmentUpload,
  getMyRequestAttachmentDownloadUrl,
  getMyRequestDetail,
  issueMyAttachmentUploadTicket,
  uploadFileToPresignedUrl,
  type FileKind,
  type RequestDetail,
  type RequestStatus,
} from "@/lib/api/my-requests";

const cancellableStatuses: RequestStatus[] = ["NEW", "APPROVED"];

const statusColorClass: Record<RequestStatus, string> = {
  NEW: "bg-sky-100 text-sky-800",
  APPROVED: "bg-indigo-100 text-indigo-800",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  IN_TRANSIT: "bg-orange-100 text-orange-800",
  DONE: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-rose-100 text-rose-800",
  CANCELED: "bg-slate-200 text-slate-800",
};

function formatDateTime(iso?: string | null) {
  if (!iso) {
    return "-";
  }

  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }

  return `${(kb / 1024).toFixed(1)} MB`;
}

function isVideoAttachment(fileKind: string, mimeType: string) {
  return fileKind === "VIDEO" || mimeType.toLowerCase().startsWith("video/");
}

export default function Page() {
  return (
    <RouteGuard tokenType="employee" redirectTo="/auth/otp">
      <MyRequestDetailContent />
    </RouteGuard>
  );
}

function MyRequestDetailContent() {
  const params = useParams<{ id: string }>();
  const requestId = typeof params.id === "string" ? params.id : "";

  const [detail, setDetail] = useState<RequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [cancelReason, setCancelReason] = useState("");
  const [canceling, setCanceling] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [uploadFileKind, setUploadFileKind] = useState<FileKind>("DOCUMENT");
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<string | null>(null);
  const [previewingAttachmentId, setPreviewingAttachmentId] = useState<string | null>(null);
  const [videoPreview, setVideoPreview] = useState<{ attachmentId: string; fileName: string; url: string } | null>(null);

  const canCancel = useMemo(() => {
    if (!detail) {
      return false;
    }

    return cancellableStatuses.includes(detail.status);
  }, [detail]);

  const loadDetail = useCallback(async () => {
    if (!requestId) {
      setErrorMessage("Invalid request id");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const result = await getMyRequestDetail(requestId);
      setDetail(result);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Failed to load request detail");
      }
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const handleCancel = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!detail) {
      return;
    }

    if (!cancelReason.trim()) {
      setErrorMessage("Cancel reason is required.");
      return;
    }

    setCanceling(true);
    setErrorMessage(null);

    try {
      await cancelMyRequest(detail.id, cancelReason.trim());
      setCancelReason("");
      await loadDetail();
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Failed to cancel request");
      }
    } finally {
      setCanceling(false);
    }
  };

  const handleUpload = async () => {
    if (!detail || !uploadFile) {
      setErrorMessage("Please choose a file before upload.");
      return;
    }

    const validation = validateAttachmentCandidate(uploadFile, uploadFileKind);
    if (!validation.ok) {
      setErrorMessage(validation.message);
      return;
    }

    setUploading(true);
    setErrorMessage(null);

    try {
      const resolvedFileKind = uploadFileKind;

      const ticket = await issueMyAttachmentUploadTicket(detail.id, {
        fileKind: resolvedFileKind,
        fileName: uploadFile.name,
        mimeType: validation.mimeType,
        fileSize: uploadFile.size,
      });

      await uploadFileToPresignedUrl(ticket, uploadFile);
      await completeMyAttachmentUpload(detail.id, ticket.uploadToken);

      setUploadFile(null);
      await loadDetail();
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Failed to upload attachment");
      }
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadAttachment = async (attachmentId: string) => {
    if (!detail) {
      return;
    }

    setDownloadingAttachmentId(attachmentId);
    setErrorMessage(null);

    try {
      const result = await getMyRequestAttachmentDownloadUrl(detail.id, attachmentId, "download");
      await downloadFileFromPresignedUrl({
        downloadUrl: result.downloadUrl,
        fallbackFileName: result.fileName,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Failed to generate attachment download URL");
      }
    } finally {
      setDownloadingAttachmentId(null);
    }
  };

  const handlePreviewAttachment = async (attachmentId: string, fileName: string) => {
    if (!detail) {
      return;
    }

    setPreviewingAttachmentId(attachmentId);
    setErrorMessage(null);

    try {
      const result = await getMyRequestAttachmentDownloadUrl(detail.id, attachmentId, "inline");
      setVideoPreview({
        attachmentId,
        fileName,
        url: result.downloadUrl,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Failed to generate attachment preview URL");
      }
    } finally {
      setPreviewingAttachmentId(null);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-6 py-10 md:px-10">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">Phase 3 - OTP and Tracking</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">Request Detail</h1>
            <p className="mt-2 text-slate-700">View timeline, attachments, and available actions for your request.</p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              className="bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100"
              onClick={() => void loadDetail()}
            >
              Refresh
            </Button>
            <Link href="/my-requests" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">
              Back to list
            </Link>
          </div>
        </div>
      </header>

      {loading ? <p className="text-sm text-slate-700">Loading request detail...</p> : null}

      {!loading && detail ? (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{detail.type}</p>
                <h2 className="text-2xl font-semibold text-slate-900">{detail.requestNo}</h2>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColorClass[detail.status]}`}>
                {detail.status}
              </span>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Urgency</p>
                <p className="font-medium text-slate-900">{detail.urgency}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Department</p>
                <p className="font-medium text-slate-900">{detail.department.name}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Latest activity</p>
                <p className="font-medium text-slate-900">{formatDateTime(detail.latestActivityAt)}</p>
              </div>
            </div>

            {detail.cancelReason ? (
              <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                <p className="font-semibold">Cancel reason</p>
                <p>{detail.cancelReason}</p>
              </div>
            ) : null}

            {detail.hrCloseNote ? (
              <div className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-800">
                <p className="font-semibold">HR close note</p>
                <p>{detail.hrCloseNote}</p>
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Service detail</h2>

            {detail.buildingRepairDetail ? (
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                <p>Building: {detail.buildingRepairDetail.building}</p>
                <p>Floor: {detail.buildingRepairDetail.floor}</p>
                <p>Location: {detail.buildingRepairDetail.locationDetail}</p>
                <p>Category: {detail.buildingRepairDetail.problemCategory.name}</p>
                <p>Description: {detail.buildingRepairDetail.description}</p>
              </div>
            ) : null}

            {detail.vehicleRepairDetail ? (
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                <p>Vehicle plate: {detail.vehicleRepairDetail.vehiclePlate}</p>
                <p>Issue category: {detail.vehicleRepairDetail.issueCategory.name}</p>
                <p>Symptom: {detail.vehicleRepairDetail.symptom}</p>
              </div>
            ) : null}

            {detail.messengerBookingDetail ? (
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                <p>Pickup datetime: {formatDateTime(detail.messengerBookingDetail.pickupDatetime)}</p>
                <p>Item type: {detail.messengerBookingDetail.itemType}</p>
                <p>Item description: {detail.messengerBookingDetail.itemDescription}</p>
                <p>Outside BKK metro: {detail.messengerBookingDetail.outsideBkkMetro ? "Yes" : "No"}</p>
              </div>
            ) : null}

            {detail.documentRequestDetail ? (
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                <p>Site: {detail.documentRequestDetail.siteNameRaw}</p>
                <p>Document: {detail.documentRequestDetail.documentDescription}</p>
                <p>Purpose: {detail.documentRequestDetail.purpose}</p>
                <p>Needed date: {formatDateTime(detail.documentRequestDetail.neededDate)}</p>
                <p>Delivery method: {detail.documentRequestDetail.deliveryMethod}</p>
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Upload attachment</h2>
            <p className="mt-2 text-sm text-slate-700">Uses the same presign upload flow as production.</p>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <SelectField
                id="uploadFileKind"
                label="File kind"
                value={uploadFileKind}
                onChange={(event) => setUploadFileKind(event.target.value as FileKind)}
              >
                <option value="DOCUMENT">DOCUMENT</option>
                <option value="IMAGE">IMAGE</option>
                <option value="VIDEO">VIDEO</option>
              </SelectField>

              <div className="space-y-2">
                <label htmlFor="uploadFile" className="block text-sm font-medium text-slate-800">
                  File
                </label>
                <input
                  id="uploadFile"
                  type="file"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  accept={getAcceptMimeTypes(uploadFileKind)}
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null;
                    setUploadFile(file);
                    if (file) {
                      const inferredKind = inferFileKindFromMimeType(resolveUploadMimeType(file) ?? "");
                      if (inferredKind) {
                        setUploadFileKind(inferredKind);
                      }
                    }
                  }}
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-500">{getAttachmentPolicySummary(uploadFileKind)}</p>

            {uploadFile ? (
              <p className="mt-3 text-sm text-slate-700">
                Selected: {uploadFile.name} ({formatFileSize(uploadFile.size)})
              </p>
            ) : null}

            <div className="mt-4">
              <Button type="button" disabled={uploading || !uploadFile} onClick={() => void handleUpload()}>
                {uploading ? "Uploading..." : "Upload attachment"}
              </Button>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Attachments</h2>

            {detail.attachments.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">No attachments.</p>
            ) : (
              <>
                <ul className="mt-3 space-y-2">
                {detail.attachments.map((attachment) => (
                  <li key={attachment.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="text-sm text-slate-700">
                      <p className="font-medium text-slate-900">{attachment.fileName}</p>
                      <p>
                        {attachment.fileKind} | {attachment.fileKind === "DOCUMENT" ? getDocumentTypeLabel(attachment.mimeType, attachment.fileName) : attachment.mimeType} | {formatFileSize(attachment.fileSize)} | {formatDateTime(attachment.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isVideoAttachment(attachment.fileKind, attachment.mimeType) ? (
                        <Button
                          type="button"
                          className="bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100"
                          onClick={() => void handlePreviewAttachment(attachment.id, attachment.fileName)}
                          disabled={previewingAttachmentId === attachment.id}
                        >
                          {previewingAttachmentId === attachment.id ? "Preparing..." : "Preview"}
                        </Button>
                      ) : null}

                      <Button
                        type="button"
                        className="bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100"
                        onClick={() => void handleDownloadAttachment(attachment.id)}
                        disabled={downloadingAttachmentId === attachment.id}
                      >
                        {downloadingAttachmentId === attachment.id ? "Preparing..." : "Download"}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>

              </>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Timeline</h2>

            {detail.activityLogs.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">No activity logs.</p>
            ) : (
              <ol className="mt-3 space-y-3">
                {detail.activityLogs.map((log) => (
                  <li key={log.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    <p className="font-semibold text-slate-900">{log.action}</p>
                    <p>
                      {log.fromStatus ?? "-"} to {log.toStatus ?? "-"}
                    </p>
                    <p>By: {log.operator?.displayName || log.actorDisplayName || log.actorRole}</p>
                    {log.note ? <p>Note: {log.note}</p> : null}
                    <p className="text-xs text-slate-500">{formatDateTime(log.createdAt)}</p>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {canCancel ? (
            <section className="rounded-2xl border border-rose-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Cancel request</h2>
              <p className="mt-2 text-sm text-slate-700">You can cancel only when status is NEW or APPROVED.</p>

              <form className="mt-4 space-y-3" onSubmit={handleCancel}>
                <TextareaField
                  id="cancelReason"
                  label="Reason"
                  required
                  value={cancelReason}
                  onChange={(event) => setCancelReason(event.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder="Please provide cancellation reason"
                />

                <Button type="submit" disabled={canceling} className="bg-rose-600 hover:bg-rose-500">
                  {canceling ? "Canceling..." : "Confirm cancel request"}
                </Button>
              </form>
            </section>
          ) : null}
        </>
      ) : null}

      {errorMessage ? (
        <section className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {errorMessage}
        </section>
      ) : null}

      <VideoPreviewModal
        open={Boolean(videoPreview)}
        title={videoPreview ? `Video preview: ${videoPreview.fileName}` : "Video preview"}
        src={videoPreview?.url ?? ""}
        onClose={() => setVideoPreview(null)}
      />
    </main>
  );
}
