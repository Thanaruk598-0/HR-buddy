"use client";

import { useEffect } from "react";

type VideoPreviewModalProps = {
  open: boolean;
  title: string;
  src: string;
  onClose: () => void;
};

export function VideoPreviewModal({ open, title, src, onClose }: VideoPreviewModalProps) {
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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 p-3 sm:p-6" onClick={onClose}>
      <div
        className="w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-black shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-700 bg-slate-900/95 px-4 py-3">
          <p className="truncate pr-3 text-sm font-semibold text-slate-100">{title}</p>
          <button
            type="button"
            className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-white"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="bg-black p-2 sm:p-3">
          <video
            key={src}
            className="h-[68vh] max-h-[760px] w-full rounded-lg bg-black object-contain"
            controls
            autoPlay
            muted
            playsInline
            preload="metadata"
          >
            <source src={src} />
            Your browser cannot play this video.
          </video>
        </div>
      </div>
    </div>
  );
}
