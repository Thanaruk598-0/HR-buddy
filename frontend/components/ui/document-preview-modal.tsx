"use client";

import { useEffect } from "react";

type DocumentPreviewModalProps = {
  open: boolean;
  title: string;
  src: string;
  mimeType?: string;
  onClose: () => void;
};

export function DocumentPreviewModal({
  open,
  title,
  src,
  mimeType,
  onClose,
}: DocumentPreviewModalProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const isPdf = mimeType === "application/pdf";
  const isBlobSource = src.startsWith("blob:");
  const pdfViewerSrc = isBlobSource
    ? `${src}#toolbar=0&navpanes=0&statusbar=0`
    : src;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
          <p className="truncate pr-3 text-sm font-semibold text-slate-800">
            {title}
          </p>
          <button
            type="button"
            className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="bg-slate-100 p-2 sm:p-3">
          {isPdf ? (
            <iframe
              title={title}
              src={pdfViewerSrc}
              className="h-[68vh] max-h-[760px] w-full rounded-lg border border-slate-200 bg-white"
            />
          ) : (
            <div className="flex h-[44vh] items-center justify-center rounded-lg border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
              This document type cannot be previewed in-browser.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
