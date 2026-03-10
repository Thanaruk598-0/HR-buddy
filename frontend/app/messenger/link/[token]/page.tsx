"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import {
  getMessengerLink,
  reportMessengerProblem,
  sendMessengerPickupEvent,
  updateMessengerLinkStatus,
  type MessengerAddress,
  type MessengerLinkDetail,
} from "@/lib/api/messenger-link";
import { Button, TextareaField } from "@/components/ui/form-controls";

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function statusBadgeClass(status: string) {
  switch (status) {
    case "APPROVED":
      return "bg-blue-100 text-blue-800";
    case "IN_TRANSIT":
      return "bg-amber-100 text-amber-800";
    case "DONE":
      return "bg-emerald-100 text-emerald-800";
    case "REJECTED":
      return "bg-rose-100 text-rose-800";
    case "CANCELED":
      return "bg-slate-200 text-slate-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "APPROVED":
      return "Approved";
    case "IN_TRANSIT":
      return "In Transit";
    case "DONE":
      return "Done";
    case "NEW":
      return "New";
    case "REJECTED":
      return "Rejected";
    case "CANCELED":
      return "Canceled";
    default:
      return status;
  }
}

function renderAddressLines(address: MessengerAddress) {
  const parts: string[] = [
    `House ${address.houseNo}`,
    address.soi ? `Soi ${address.soi}` : "",
    address.road ? `Road ${address.road}` : "",
    address.subdistrict,
    address.district,
    address.province,
    address.postalCode,
  ].filter((part) => part.trim().length > 0);

  return parts.join(", ");
}

export default function Page() {
  const params = useParams<{ token: string | string[] }>();
  const tokenRaw = params?.token;
  const token = useMemo(() => {
    if (!tokenRaw) {
      return "";
    }

    const value = Array.isArray(tokenRaw) ? tokenRaw[0] : tokenRaw;
    return decodeURIComponent(value ?? "");
  }, [tokenRaw]);

  const [detail, setDetail] = useState<MessengerLinkDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [statusNote, setStatusNote] = useState("");
  const [pickupNote, setPickupNote] = useState("");
  const [problemNote, setProblemNote] = useState("");

  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [sendingPickup, setSendingPickup] = useState(false);
  const [sendingProblem, setSendingProblem] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!token) {
      setErrorMessage("Messenger token is missing");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const result = await getMessengerLink(token);
      setDetail(result);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Failed to load messenger link");
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const isExpired = useMemo(() => {
    if (!detail) {
      return false;
    }

    return new Date(detail.expiresAt).getTime() <= Date.now();
  }, [detail]);

  const nextStatus = useMemo(() => {
    if (!detail) {
      return null;
    }

    if (detail.request.status === "APPROVED") {
      return "IN_TRANSIT" as const;
    }

    if (detail.request.status === "IN_TRANSIT") {
      return "DONE" as const;
    }

    return null;
  }, [detail]);

  const canSendPickup = useMemo(() => {
    if (!detail) {
      return false;
    }

    return detail.request.status === "APPROVED" || detail.request.status === "IN_TRANSIT";
  }, [detail]);

  const handleUpdateStatus = async () => {
    if (!detail || !nextStatus || isExpired) {
      return;
    }

    setUpdatingStatus(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await updateMessengerLinkStatus(token, {
        status: nextStatus,
        ...(statusNote.trim() ? { note: statusNote.trim() } : {}),
      });
      setStatusNote("");
      setSuccessMessage(`Status updated to ${statusLabel(nextStatus)}`);
      await loadDetail();
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Failed to update status");
      }
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handlePickupEvent = async () => {
    if (isExpired || !detail || !canSendPickup) {
      return;
    }

    setSendingPickup(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await sendMessengerPickupEvent(token, pickupNote);
      setPickupNote("");
      setSuccessMessage("Pickup event sent");
      await loadDetail();
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Failed to send pickup event");
      }
    } finally {
      setSendingPickup(false);
    }
  };

  const handleReportProblem = async () => {
    if (isExpired || !detail) {
      return;
    }

    const note = problemNote.trim();
    if (!note) {
      setErrorMessage("Problem note is required");
      return;
    }

    setSendingProblem(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await reportMessengerProblem(token, note);
      setProblemNote("");
      setSuccessMessage("Problem report sent to HR");
      await loadDetail();
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Failed to report problem");
      }
    } finally {
      setSendingProblem(false);
    }
  };

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600">Loading messenger link...</p>
        </section>
      </main>
    );
  }

  if (!detail) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-rose-900">Messenger link unavailable</h1>
          <p className="mt-2 text-sm text-rose-700">{errorMessage ?? "This link is invalid or expired"}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Messenger Magic Link</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">{detail.request.requestNo}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass(detail.request.status)}`}>
            {statusLabel(detail.request.status)}
          </span>
          <span className="text-xs text-slate-500">Expires: {formatDateTime(detail.expiresAt)}</span>
        </div>
        {isExpired ? (
          <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
            This magic link has expired.
          </p>
        ) : null}
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Job Detail</h2>
        <div className="mt-4 space-y-2 text-sm text-slate-700">
          <p>
            <span className="font-medium text-slate-900">Pickup:</span> {formatDateTime(detail.messengerDetail.pickupDatetime)}
          </p>
          <p>
            <span className="font-medium text-slate-900">Item Type:</span> {detail.messengerDetail.itemType}
          </p>
          <p>
            <span className="font-medium text-slate-900">Description:</span> {detail.messengerDetail.itemDescription}
          </p>
          <p>
            <span className="font-medium text-slate-900">Outside BKK Metro:</span> {detail.messengerDetail.outsideBkkMetro ? "Yes" : "No"}
          </p>
          {detail.messengerDetail.outsideBkkMetro ? (
            <p>
              <span className="font-medium text-slate-900">Delivery Service:</span>{" "}
              {detail.messengerDetail.deliveryService === "OTHER"
                ? detail.messengerDetail.deliveryServiceOther ?? "OTHER"
                : detail.messengerDetail.deliveryService ?? "-"}
            </p>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Sender</h2>
        <div className="mt-3 space-y-1 text-sm text-slate-700">
          <p>{detail.messengerDetail.senderAddress.name}</p>
          <p>{detail.messengerDetail.senderAddress.phone}</p>
          <p>{renderAddressLines(detail.messengerDetail.senderAddress)}</p>
          {detail.messengerDetail.senderAddress.extra ? <p>Note: {detail.messengerDetail.senderAddress.extra}</p> : null}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Receiver</h2>
        <div className="mt-3 space-y-1 text-sm text-slate-700">
          <p>{detail.messengerDetail.receiverAddress.name}</p>
          <p>{detail.messengerDetail.receiverAddress.phone}</p>
          <p>{renderAddressLines(detail.messengerDetail.receiverAddress)}</p>
          {detail.messengerDetail.receiverAddress.extra ? <p>Note: {detail.messengerDetail.receiverAddress.extra}</p> : null}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Actions</h2>
        <p className="mt-1 text-sm text-slate-600">Update status, record pickup event, or report issue to HR.</p>

        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Update Status</h3>
            <p className="mt-1 text-xs text-slate-500">
              Allowed: APPROVED ? IN_TRANSIT, IN_TRANSIT ? DONE
            </p>
            <div className="mt-3">
              <TextareaField
                id="statusNote"
                label="Status Note"
                value={statusNote}
                onChange={(event) => setStatusNote(event.target.value)}
                placeholder="Optional note"
                rows={2}
                maxLength={2000}
              />
            </div>
            <div className="mt-3">
              <Button
                type="button"
                onClick={handleUpdateStatus}
                disabled={!nextStatus || isExpired || updatingStatus || sendingPickup || sendingProblem}
              >
                {updatingStatus
                  ? "Updating..."
                  : nextStatus
                    ? `Set to ${statusLabel(nextStatus)}`
                    : "No status transition available"}
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Pickup Event</h3>
            <div className="mt-3">
              <TextareaField
                id="pickupNote"
                label="Pickup Note"
                value={pickupNote}
                onChange={(event) => setPickupNote(event.target.value)}
                placeholder="Optional note"
                rows={2}
                maxLength={500}
              />
            </div>
            <div className="mt-3">
              <Button
                type="button"
                onClick={handlePickupEvent}
                disabled={!canSendPickup || isExpired || sendingPickup || updatingStatus || sendingProblem}
              >
                {sendingPickup ? "Sending..." : "Mark Pickup Event"}
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Report Problem</h3>
            <div className="mt-3">
              <TextareaField
                id="problemNote"
                label="Problem Note"
                required
                value={problemNote}
                onChange={(event) => setProblemNote(event.target.value)}
                placeholder="Describe issue for HR"
                rows={3}
                maxLength={2000}
              />
            </div>
            <div className="mt-3">
              <Button
                type="button"
                onClick={handleReportProblem}
                disabled={isExpired || sendingProblem || updatingStatus || sendingPickup}
              >
                {sendingProblem ? "Sending..." : "Report to HR"}
              </Button>
            </div>
          </div>
        </div>

        {errorMessage ? (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        {successMessage ? (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
            {successMessage}
          </div>
        ) : null}
      </section>
    </main>
  );
}
