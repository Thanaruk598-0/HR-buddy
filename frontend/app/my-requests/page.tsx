"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RouteGuard } from "@/components/guards/route-guard";
import { Button, SelectField, TextField } from "@/components/ui/form-controls";
import { ApiError } from "@/lib/api/client";
import {
  getMyRequests,
  type MyRequestItem,
  type RequestStatus,
  type RequestType,
} from "@/lib/api/my-requests";
import {
  getMyNotifications,
  markMyNotificationsReadAll,
  type NotificationItem,
} from "@/lib/api/notifications";
import { clearAuthToken } from "@/lib/auth/tokens";

const requestTypeOptions: Array<{ value: RequestType; label: string }> = [
  { value: "BUILDING", label: "Building" },
  { value: "VEHICLE", label: "Vehicle" },
  { value: "MESSENGER", label: "Messenger" },
  { value: "DOCUMENT", label: "Document" },
];

const requestStatusOptions: Array<{ value: RequestStatus; label: string }> = [
  { value: "NEW", label: "New" },
  { value: "APPROVED", label: "Approved" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "IN_TRANSIT", label: "In Transit" },
  { value: "DONE", label: "Done" },
  { value: "REJECTED", label: "Rejected" },
  { value: "CANCELED", label: "Canceled" },
];

const statusColorClass: Record<RequestStatus, string> = {
  NEW: "bg-sky-100 text-sky-800",
  APPROVED: "bg-indigo-100 text-indigo-800",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  IN_TRANSIT: "bg-orange-100 text-orange-800",
  DONE: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-rose-100 text-rose-800",
  CANCELED: "bg-slate-200 text-slate-800",
};

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export default function Page() {
  return (
    <RouteGuard tokenType="employee" redirectTo="/auth/otp">
      <MyRequestsContent />
    </RouteGuard>
  );
}

function MyRequestsContent() {
  const [items, setItems] = useState<MyRequestItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 20;

  const [search, setSearch] = useState("");
  const [type, setType] = useState<"" | RequestType>("");
  const [status, setStatus] = useState<"" | RequestStatus>("");

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const unreadCount = useMemo(() => notifications.filter((n) => !n.isRead).length, [notifications]);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setErrorMessage(null);

      try {
        const [requestsResult, notificationsResult] = await Promise.all([
          getMyRequests({
            page,
            limit,
            q: search.trim() || undefined,
            type: type || undefined,
            status: status || undefined,
            sortBy: "latestActivityAt",
            sortOrder: "desc",
          }),
          getMyNotifications(20),
        ]);

        if (!active) {
          return;
        }

        setItems(requestsResult.items);
        setTotal(requestsResult.total);
        setNotifications(notificationsResult.items);
      } catch (error) {
        if (!active) {
          return;
        }

        if (error instanceof ApiError) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage("Failed to load my requests");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [limit, page, search, status, type]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const handleMarkAllRead = async () => {
    try {
      await markMyNotificationsReadAll();
      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Failed to mark notifications as read");
      }
    }
  };

  const handleLogout = () => {
    clearAuthToken("employee");
    window.location.href = "/auth/otp";
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-6 py-10 md:px-10">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">Phase 3 - OTP and Tracking</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">My Requests</h1>
            <p className="mt-2 text-slate-700">Track all requests linked to your verified phone and email.</p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              className="bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100"
              onClick={handleLogout}
            >
              Logout
            </Button>
          </div>
        </div>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Notifications</h2>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              Unread: {unreadCount}
            </span>
            <Button type="button" onClick={handleMarkAllRead} disabled={unreadCount === 0}>
              Mark all read
            </Button>
          </div>
        </div>

        <ul className="mt-4 space-y-2">
          {notifications.length === 0 ? (
            <li className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">No notifications.</li>
          ) : (
            notifications.slice(0, 5).map((item) => (
              <li key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <p className="font-medium text-slate-900">{item.title}</p>
                <p className="text-slate-700">{item.message}</p>
                <p className="text-xs text-slate-500">{formatDateTime(item.createdAt)}</p>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-4">
          <TextField
            id="q"
            label="Search"
            value={search}
            onChange={(event) => {
              setPage(1);
              setSearch(event.target.value);
            }}
            placeholder="Request no or name"
          />

          <SelectField
            id="type"
            label="Type"
            value={type}
            onChange={(event) => {
              setPage(1);
              setType(event.target.value as "" | RequestType);
            }}
          >
            <option value="">All</option>
            {requestTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>

          <SelectField
            id="status"
            label="Status"
            value={status}
            onChange={(event) => {
              setPage(1);
              setStatus(event.target.value as "" | RequestStatus);
            }}
          >
            <option value="">All</option>
            {requestStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>

          <div className="flex items-end">
            <Button
              type="button"
              className="w-full bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100"
              onClick={() => {
                setSearch("");
                setType("");
                setStatus("");
                setPage(1);
              }}
            >
              Reset filters
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {loading ? (
          <p className="text-sm text-slate-600">Loading requests...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-600">No requests found.</p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <article key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.type}</p>
                    <h3 className="text-lg font-semibold text-slate-900">{item.requestNo}</h3>
                    <p className="text-sm text-slate-700">Latest activity: {formatDateTime(item.latestActivityAt)}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColorClass[item.status]}`}>
                    {item.status}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <p className="text-sm text-slate-600">Urgency: {item.urgency}</p>
                  <Link
                    href={`/my-requests/${item.id}`}
                    className="text-sm font-medium text-slate-900 underline underline-offset-4"
                  >
                    View detail
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="mt-5 flex items-center justify-between gap-2">
          <p className="text-sm text-slate-600">
            Page {page} / {totalPages} ({total} items)
          </p>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              className="bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100"
              disabled={page <= 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              Previous
            </Button>
            <Button
              type="button"
              className="bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100"
              disabled={page >= totalPages}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      </section>

      {errorMessage ? (
        <section className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {errorMessage}
        </section>
      ) : null}
    </main>
  );
}
