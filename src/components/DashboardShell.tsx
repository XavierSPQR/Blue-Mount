"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@/components/SignOutButton";
import { useAuth } from "@/context/AuthContext";
import { DASHBOARD_PATH_BY_ROLE } from "@/types/user";
import { COMPANY_NAME } from "@/lib/companyInfo";

export interface NavLink {
  href: string;
  label: string;
  /** Count shown as a small pill next to the label (e.g. pending items awaiting a decision). Omit or 0 to hide. */
  badge?: number;
  /** Draws a divider before this link, so a long nav (admin's 9 links) reads as clusters instead of one flat row. */
  newGroup?: boolean;
}

export function DashboardShell({ navLinks, children }: { navLinks: NavLink[]; children: React.ReactNode }) {
  const { appUser } = useAuth();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // Collectors in particular work from a phone in the field — the nav list
  // (9 links for admin) has to collapse behind a toggle below `sm`, not
  // just wrap or scroll off. Close it automatically on navigation — adjusted
  // during render (React's recommended pattern for this), not in an effect,
  // so there's no extra render pass on every route change.
  const [menuOpenForPathname, setMenuOpenForPathname] = useState(pathname);
  if (pathname !== menuOpenForPathname) {
    setMenuOpenForPathname(pathname);
    setMenuOpen(false);
  }

  const homeHref = appUser ? DASHBOARD_PATH_BY_ROLE[appUser.role] : "/";

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <header className="border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-6">
            <Link href={homeHref} className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Image src="/logo.jpeg" alt="" width={24} height={24} className="h-6 w-6 shrink-0 rounded object-cover" />
              {COMPANY_NAME}
            </Link>
            <nav className="hidden items-center gap-1 sm:flex">
              {navLinks.map((link) => (
                <span key={link.href} className="flex items-center">
                  {link.newGroup && <span aria-hidden className="mx-2 h-4 w-px bg-gray-300" />}
                  <Link
                    href={link.href}
                    aria-current={pathname === link.href ? "page" : undefined}
                    className={navLinkClass(pathname === link.href)}
                  >
                    {link.label}
                    <NavBadge count={link.badge} />
                  </Link>
                </span>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {appUser && (
              <span className="hidden text-sm text-gray-500 sm:inline">
                {appUser.displayName} · <span className="capitalize">{appUser.role}</span>
              </span>
            )}
            <SignOutButton />
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
              className="rounded-control border border-gray-300 p-3 text-gray-600 hover:bg-gray-50 sm:hidden"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                {menuOpen ? (
                  <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
                ) : (
                  <path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav id="mobile-nav" className="flex flex-col gap-0.5 border-t border-gray-200 px-4 py-2 sm:hidden">
            {navLinks.map((link) => (
              <span key={link.href}>
                {link.newGroup && <span className="my-1 block border-t border-gray-100" />}
                <Link
                  href={link.href}
                  aria-current={pathname === link.href ? "page" : undefined}
                  className={`flex items-center rounded-control px-2 py-2.5 text-sm ${
                    pathname === link.href ? "bg-gray-100 font-medium text-gray-900" : "text-gray-600"
                  }`}
                >
                  {link.label}
                  <NavBadge count={link.badge} />
                </Link>
              </span>
            ))}
            {appUser && (
              <p className="mt-1 border-t border-gray-100 px-2 pt-2 text-sm text-gray-500">
                {appUser.displayName} · <span className="capitalize">{appUser.role}</span>
              </p>
            )}
          </nav>
        )}
      </header>
      <main id="main-content" className="flex-1 bg-gray-50 p-4 sm:p-6">
        {children}
      </main>
    </div>
  );
}

function NavBadge({ count }: { count?: number }) {
  if (!count) return null;
  return (
    <span className="ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-amber-700 px-1.5 py-0.5 text-[11px] font-semibold leading-tight text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function navLinkClass(active: boolean) {
  return `flex items-center rounded-control px-2.5 py-2 text-sm transition-colors duration-150 ${
    active ? "bg-gray-100 font-medium text-gray-900" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
  }`;
}
