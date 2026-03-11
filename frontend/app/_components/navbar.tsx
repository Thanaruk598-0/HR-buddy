"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthToken } from "@/lib/auth/use-auth-token";

const navItems = [
  {
    href: "/",
    label: "หน้าแรก",
    iconPath:
      "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0h6",
  },
  {
    href: "/my-requests",
    label: "คำขอของฉัน",
    iconPath:
      "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h10a2 2 0 012 2v14a2 2 0 01-2 2z",
  },
] as const;

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const adminToken = useAuthToken("admin");
  const isAdminSignedIn = Boolean(adminToken);

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return null;
  }

  return (
    <nav className="fixed inset-x-0 top-0 z-50 [font-family:var(--font-content)]">
      <div className="h-[3px] w-full bg-gradient-to-r from-[#0e2d4c] via-[#b62026] to-[#fed54f]" />

      <div className="border-b border-[#0e2d4c]/10 bg-white/95 backdrop-blur-xl shadow-[0_6px_26px_-10px_rgba(14,45,76,0.14)]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-[76px] items-center justify-between">
            <Link href="/" className="group flex items-center gap-4">
              <div className="relative">
                <div className="absolute -inset-1 rounded-xl bg-gradient-to-br from-[#0e2d4c] to-[#b62026] opacity-0 blur transition duration-300 group-hover:opacity-30" />
                <div className="relative rounded-xl border border-[#0e2d4c]/12 bg-white p-2 shadow-sm">
                  <Image
                    src="/company-logo-navbar.jpg"
                    alt="Construction Lines"
                    width={44}
                    height={44}
                    className="h-11 w-11 rounded-lg object-contain"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="[font-family:var(--font-headline)] text-[14px] font-bold uppercase tracking-[0.16em] text-[#0e2d4c]/60 transition duration-300 group-hover:text-[#0e2d4c]/80">
                  Construction Lines
                </span>
                <span
                  className="[font-family:var(--font-headline)] text-[24px] font-bold leading-none tracking-tight text-[#0e2d4c] transition duration-300 group-hover:text-[#b62026]"
                  style={{ letterSpacing: "-0.02em" }}
                >
                  HR{" "}
                  <span className="text-[#b62026] transition duration-300 group-hover:text-[#0e2d4c]">
                    Buddy
                  </span>
                </span>
              </div>
            </Link>

            <div className="hidden items-center gap-1.5 md:flex">
              {navItems.map((item) => {
                const isActive = isActivePath(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={`
                      group/link relative inline-flex items-center gap-2
                      rounded-xl overflow-hidden px-[18px] py-[11px]
                      text-[14px] font-semibold
                      transition-all duration-200
                      focus-visible:outline-none focus-visible:ring-2
                      focus-visible:ring-[#fed54f] focus-visible:ring-offset-2
                      ${
                        isActive
                          ? "bg-[#0e2d4c] text-white shadow-md shadow-[#0e2d4c]/20 ring-1 ring-white/10"
                          : "text-[#0e2d4c]/70 hover:bg-[#0e2d4c]/6 hover:text-[#0e2d4c]"
                      }
                    `}
                  >
                    <svg
                      className="h-4 w-4 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d={item.iconPath}
                      />
                    </svg>
                    {item.label}

                    {isActive && (
                      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-[#fed54f]/90" />
                    )}
                  </Link>
                );
              })}

              <div className="mx-3.5 h-8 w-px bg-gradient-to-b from-transparent via-[#0e2d4c]/15 to-transparent" />

              <Link
                href={isAdminSignedIn ? "/admin" : "/admin/login"}
                className="
                  group/btn relative inline-flex items-center gap-2.5 overflow-hidden
                  rounded-xl bg-[#b62026] px-[22px] py-[11px]
                  text-[14px] font-bold text-white
                  shadow-md shadow-[#b62026]/25
                  transition-all duration-300
                  hover:-translate-y-px hover:shadow-lg hover:shadow-[#b62026]/35
                  focus-visible:outline-none focus-visible:ring-2
                  focus-visible:ring-[#fed54f] focus-visible:ring-offset-2
                "
              >
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 group-hover/btn:translate-x-full" />

                <svg
                  className="relative h-[17px] w-[17px] shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                  />
                </svg>
                <span className="relative">
                  {isAdminSignedIn ? "กลับสู่ Dashboard" : "เข้าสู่ระบบ Admin"}
                </span>
              </Link>
            </div>

            <button
              onClick={() => setMobileMenuOpen((p) => !p)}
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
              className="
                relative inline-flex h-11 w-11 items-center justify-center
                rounded-xl border border-[#0e2d4c]/12 bg-white
                text-[#0e2d4c] shadow-sm
                transition-all duration-200
                hover:border-[#b62026]/40 hover:text-[#b62026] hover:shadow-md
                focus-visible:outline-none focus-visible:ring-2
                focus-visible:ring-[#fed54f] md:hidden
              "
            >
              <span
                className={`absolute h-[1.5px] w-[22px] bg-current transition-all duration-300 ${mobileMenuOpen ? "rotate-45" : "-translate-y-[6px]"}`}
              />
              <span
                className={`absolute h-[1.5px] w-[22px] bg-current transition-all duration-300 ${mobileMenuOpen ? "scale-x-0 opacity-0" : ""}`}
              />
              <span
                className={`absolute h-[1.5px] w-[22px] bg-current transition-all duration-300 ${mobileMenuOpen ? "-rotate-45" : "translate-y-[6px]"}`}
              />
            </button>
          </div>
        </div>
      </div>

      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out md:hidden ${mobileMenuOpen ? "max-h-[420px] opacity-100" : "pointer-events-none max-h-0 opacity-0"}`}
      >
        <div className="border-b border-[#0e2d4c]/10 bg-white/98 px-4 pb-6 pt-3 shadow-xl backdrop-blur-xl">
          <div className="space-y-1 rounded-2xl border border-[#0e2d4c]/8 bg-[#f8f9fc] p-2">
            {navItems.map((item) => {
              const isActive = isActivePath(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`
                    flex items-center gap-3 rounded-xl px-4 py-3
                    text-[14px] font-semibold
                    transition-all duration-200
                    ${
                      isActive
                        ? "bg-[#0e2d4c] text-white shadow-sm"
                        : "text-[#0e2d4c]/70 hover:bg-white hover:text-[#0e2d4c] hover:shadow-sm"
                    }
                  `}
                >
                  <span
                    className={`h-5 w-[3px] rounded-full transition-all ${isActive ? "bg-[#fed54f]" : "bg-transparent"}`}
                  />
                  <svg
                    className="h-[17px] w-[17px] shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d={item.iconPath}
                    />
                  </svg>
                  {item.label}
                </Link>
              );
            })}

            <div className="mx-2 my-2 h-px bg-[#0e2d4c]/8" />

            <Link
              href={isAdminSignedIn ? "/admin" : "/admin/login"}
              onClick={() => setMobileMenuOpen(false)}
              className="
                group/mbtn relative flex items-center justify-center gap-2.5 overflow-hidden
                rounded-xl bg-[#b62026] px-4 py-3.5
                text-[14px] font-bold text-white
                shadow-md shadow-[#b62026]/20
                transition-all duration-300 hover:shadow-lg
              "
            >
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-500 group-hover/mbtn:translate-x-full" />
              <svg
                className="relative h-5 w-5 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                />
              </svg>
              <span className="relative">
                {isAdminSignedIn ? "กลับสู่ Dashboard" : "เข้าสู่ระบบ Admin"}
              </span>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
