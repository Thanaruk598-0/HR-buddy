"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { RouteGuard } from "@/components/guards/route-guard";
import { Button, SelectField, TextField, TextareaField } from "@/components/ui/form-controls";
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
  completeAdminAttachmentUpload,
  getAdminAttachmentDownloadUrl,
  getAdminRequestDetail,
  issueAdminAttachmentUploadTicket,
  updateAdminRequestStatus,
  uploadFileToPresignedUrl,
  type AdminRequestDetail,
  type AdminRequestStatus,
  type AdminRequestType,
  type FileKind,
} from "@/lib/api/admin-requests";
import { getAdminOperators, type AdminOperator } from "@/lib/api/admin-settings";

const transitionByType: Record<AdminRequestType, Record<AdminRequestStatus, AdminRequestStatus[]>> = {
  BUILDING: {
    NEW: ["APPROVED", "REJECTED", "CANCELED"],
    APPROVED: ["IN_PROGRESS", "DONE", "CANCELED"],
    IN_PROGRESS: ["DONE", "CANCELED"],
    IN_TRANSIT: [],
    DONE: [],
    REJECTED: [],
    CANCELED: [],
  },
  VEHICLE: {
    NEW: ["APPROVED", "REJECTED", "CANCELED"],
    APPROVED: ["IN_PROGRESS", "DONE", "CANCELED"],
    IN_PROGRESS: ["DONE", "CANCELED"],
    IN_TRANSIT: [],
    DONE: [],
    REJECTED: [],
    CANCELED: [],
  },
  MESSENGER: {
    NEW: ["APPROVED", "REJECTED", "CANCELED"],
    APPROVED: ["IN_TRANSIT", "CANCELED"],
    IN_PROGRESS: [],
    IN_TRANSIT: ["DONE", "CANCELED"],
    DONE: [],
    REJECTED: [],
    CANCELED: [],
  },
  DOCUMENT: {
    NEW: ["APPROVED", "REJECTED", "CANCELED"],
    APPROVED: ["DONE", "CANCELED"],
    IN_PROGRESS: [],
    IN_TRANSIT: [],
    DONE: [],
    REJECTED: [],
    CANCELED: [],
  },
};

const statusColorClass: Record<AdminRequestStatus, string> = {
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
    <RouteGuard tokenType="admin" redirectTo="/admin/login">
      <AdminRequestDetailContent />
    </RouteGuard>
  );
}

function AdminRequestDetailContent() {
  const params = useParams<{ id: string }>();
  const requestId = typeof params.id === "string" ? params.id : "";

  const [detail, setDetail] = useState<AdminRequestDetail | null>(null);
  const [operators, setOperators] = useState<AdminOperator[]>([]);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [targetStatus, setTargetStatus] = useState<AdminRequestStatus | "">("");
  const [operatorId, setOperatorId] = useState("");
  const [note, setNote] = useState("");
  const [pickupNote, setPickupNote] = useState("");
  const [digitalAttachmentId, setDigitalAttachmentId] = useState("");
  const [submittingStatus, setSubmittingStatus] = useState(false);
  const [messengerMagicLink, setMessengerMagicLink] = useState<{ url: string; expiresAt: string } | null>(null);
  const [magicLinkCopyState, setMagicLinkCopyState] = useState<"idle" | "copied" | "failed">("idle");

  const [uploading, setUploading] = useState(false);
  const [uploadFileKind, setUploadFileKind] = useState<FileKind>("DOCUMENT");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<string | null>(null);
  const [previewingAttachmentId, setPreviewingAttachmentId] = useState<string | null>(null);
  const [videoPreview, setVideoPreview] = useState<{ attachmentId: string; fileName: string; url: string } | null>(null);

  const availableTransitions = useMemo(() => {
    if (!detail) {
      return [];
    }

    return transitionByType[detail.type][detail.status] ?? [];
  }, [detail]);

  const documentDeliveryMethod = detail?.documentRequestDetail?.deliveryMethod;
  const documentAttachmentOptions = useMemo(() => {
    if (!detail) {
      return [];
    }

    return detail.attachments.filter((item) => item.fileKind === "DOCUMENT");
  }, [detail]);

  const loadData = useCallback(async () => {
    if (!requestId) {
      setErrorMessage("Invalid request id");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const [detailResult, operatorsResult] = await Promise.all([
        getAdminRequestDetail(requestId),
        getAdminOperators(),
      ]);

      setDetail(detailResult);
      setOperators(operatorsResult.items);

      setTargetStatus(detailResult.status);
      setOperatorId((prev) => prev || operatorsResult.items[0]?.id || "");
      setPickupNote(detailResult.documentRequestDetail?.pickupNote || "");
      setDigitalAttachmentId(detailResult.documentRequestDetail?.digitalFileAttachmentId || "");
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Failed to load admin request detail");
      }
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleUpdateStatus = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!detail) {
      return;
    }

    if (!operatorId) {
      setErrorMessage("Operator is required.");
      return;
    }

    if (!targetStatus || targetStatus === detail.status) {
      setErrorMessage("Please select a valid next status.");
      return;
    }

    if (detail.type === "DOCUMENT" && targetStatus === "DONE") {
      if (documentDeliveryMethod === "PICKUP" && !pickupNote.trim()) {
        setErrorMessage("pickupNote is required for DOCUMENT/PICKUP when setting DONE.");
        return;
      }

      if (documentDeliveryMethod === "DIGITAL" && !digitalAttachmentId) {
        setErrorMessage("digitalFileAttachmentId is required for DOCUMENT/DIGITAL when setting DONE.");
        return;
      }
    }

    setSubmittingStatus(true);
    setErrorMessage(null);

    try {
      const result = await updateAdminRequestStatus(detail.id, {
        status: targetStatus,
        operatorId,
        note: note.trim() || undefined,
        pickupNote: pickupNote.trim() || undefined,
        digitalFileAttachmentId: digitalAttachmentId || undefined,
      });

      if (result.magicLink?.url) {
        setMessengerMagicLink({
          url: result.magicLink.url,
          expiresAt: result.magicLink.expiresAt,
        });
        setMagicLinkCopyState("idle");
      } else if (detail.type === "MESSENGER") {
        setMessengerMagicLink(null);
        setMagicLinkCopyState("idle");
      }

      setNote("");
      await loadData();
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Failed to update request status");
      }
    } finally {
      setSubmittingStatus(false);
    }
  };

  const handleCopyMagicLink = async () => {
    if (!messengerMagicLink?.url) {
      return;
    }

    try {
      await navigator.clipboard.writeText(messengerMagicLink.url);
      setMagicLinkCopyState("copied");
    } catch {
      setMagicLinkCopyState("failed");
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

      const ticket = await issueAdminAttachmentUploadTicket(detail.id, {
        fileKind: resolvedFileKind,
        fileName: uploadFile.name,
        mimeType: validation.mimeType,
        fileSize: uploadFile.size,
      });

      await uploadFileToPresignedUrl(ticket, uploadFile);
      await completeAdminAttachmentUpload(detail.id, ticket.uploadToken);

      setUploadFile(null);
      await loadData();
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
      const result = await getAdminAttachmentDownloadUrl(detail.id, attachmentId, "download");
      await downloadFileFromPresignedUrl({
        downloadUrl: result.downloadUrl,
        fallbackFileName: result.fileName,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Failed to get attachment download URL");
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
      const result = await getAdminAttachmentDownloadUrl(detail.id, attachmentId, "inline");
      setVideoPreview({
        attachmentId,
        fileName,
        url: result.downloadUrl,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Failed to get attachment preview URL");
      }
    } finally {
      setPreviewingAttachmentId(null);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-6 py-10 md:px-10">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">Phase 5 - Admin Core</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">Admin Request Detail</h1>
            <p className="mt-2 text-slate-700">Manage status transitions, operator audit data, and attachments.</p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              className="bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100"
              onClick={() => void loadData()}
            >
              Refresh
            </Button>
            <Link href="/admin/requests" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">
              Back to requests
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
                <p className="text-sm text-slate-700">{detail.employeeName} | {detail.phone}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColorClass[detail.status]}`}>
                {detail.status}
              </span>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Urgency</p>
                <p className="font-medium text-slate-900">{detail.urgency}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Department</p>
                <p className="font-medium text-slate-900">{detail.department.name}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Created</p>
                <p className="font-medium text-slate-900">{formatDateTime(detail.createdAt)}</p>
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
            <h2 className="text-lg font-semibold text-slate-900">Status action</h2>
            <p className="mt-2 text-sm text-slate-700">
              Allowed next statuses: {availableTransitions.length > 0 ? availableTransitions.join(", ") : "No transitions allowed"}
            </p>

            <form className="mt-4 space-y-4" onSubmit={handleUpdateStatus}>
              <div className="grid gap-4 md:grid-cols-2">
                <SelectField
                  id="targetStatus"
                  label="Next status"
                  required
                  value={targetStatus}
                  onChange={(event) => setTargetStatus(event.target.value as AdminRequestStatus)}
                >
                  <option value="">Select status</option>
                  {availableTransitions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </SelectField>

                <SelectField
                  id="operatorId"
                  label="Operator"
                  required
                  value={operatorId}
                  onChange={(event) => setOperatorId(event.target.value)}
                >
                  <option value="">Select operator</option>
                  {operators.map((operator) => (
                    <option key={operator.id} value={operator.id}>
                      {operator.displayName}
                    </option>
                  ))}
                </SelectField>
              </div>

              <TextareaField
                id="note"
                label="Note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="Optional action note"
              />

              {detail.type === "DOCUMENT" && targetStatus === "DONE" && documentDeliveryMethod === "PICKUP" ? (
                <TextField
                  id="pickupNote"
                  label="Pickup note"
                  required
                  value={pickupNote}
                  onChange={(event) => setPickupNote(event.target.value)}
                  maxLength={500}
                  placeholder="Pickup point and time"
                />
              ) : null}

              {detail.type === "DOCUMENT" && targetStatus === "DONE" && documentDeliveryMethod === "DIGITAL" ? (
                <SelectField
                  id="digitalFileAttachmentId"
                  label="Digital file attachment"
                  required
                  value={digitalAttachmentId}
                  onChange={(event) => setDigitalAttachmentId(event.target.value)}
                >
                  <option value="">Select document attachment</option>
                  {documentAttachmentOptions.map((attachment) => (
                    <option key={attachment.id} value={attachment.id}>
                      {attachment.fileName}
                    </option>
                  ))}
                </SelectField>
              ) : null}

              <Button type="submit" disabled={submittingStatus || availableTransitions.length === 0}>
                {submittingStatus ? "Updating..." : "Update status"}
              </Button>
            </form>

            {messengerMagicLink ? (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                <p className="font-semibold">Messenger magic link generated</p>
                <p className="mt-1 break-all">{messengerMagicLink.url}</p>
                <p className="mt-1 text-xs text-emerald-800">Expires: {formatDateTime(messengerMagicLink.expiresAt)}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    className="bg-white text-emerald-900 ring-1 ring-emerald-300 hover:bg-emerald-100"
                    onClick={() => void handleCopyMagicLink()}
                  >
                    {magicLinkCopyState === "copied" ? "Copied" : "Copy link"}
                  </Button>
                  <a
                    href={messengerMagicLink.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
                  >
                    Open link
                  </a>
                </div>
                {magicLinkCopyState === "failed" ? (
                  <p className="mt-2 text-xs text-rose-700">Copy failed. Please copy link manually.</p>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Upload attachment</h2>
            <p className="mt-2 text-sm text-slate-700">Uses presign, upload, and complete flow (same as production path).</p>

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
                        {attachment.fileKind} | {attachment.fileKind === "DOCUMENT" ? getDocumentTypeLabel(attachment.mimeType, attachment.fileName) : attachment.mimeType} | {formatFileSize(attachment.fileSize)}
                      </p>
                      <p className="text-xs text-slate-500">{formatDateTime(attachment.createdAt)}</p>
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
