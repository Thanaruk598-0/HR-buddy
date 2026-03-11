"use client";

import { usePathname } from "next/navigation";

export function SiteFooter() {
  const pathname = usePathname();

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return null;
  }

  return (
    <footer className="relative mt-10 overflow-hidden border-t border-[#0e2d4c]/10 bg-gradient-to-b from-white via-[#f8fafc] to-[#edf3ff] py-7 text-center backdrop-blur-sm">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#fed54f] to-transparent" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0e2d4c]/55">
          Construction Lines - HR Buddy
        </p>
        <p className="mt-1 text-sm text-[#0e2d4c]/70">
          &copy; 2026 Construction Lines. All rights reserved.
        </p>
      </div>
    </footer>
  );
}