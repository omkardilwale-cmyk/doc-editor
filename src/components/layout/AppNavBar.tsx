"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/pdfeditor": "PDF Editor",
};

function pageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  for (const [path, title] of Object.entries(PAGE_TITLES)) {
    if (path !== "/" && pathname.startsWith(path)) return title;
  }
  return "Doc Editor";
}

export function AppNavBar() {
  const router = useRouter();
  const pathname = usePathname();
  const title = pageTitle(pathname);

  return (
    <nav className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center gap-1.5 px-3 py-2 sm:gap-2 sm:px-4">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-9 min-w-9 items-center justify-center rounded-lg border border-zinc-200 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 sm:px-2.5"
            aria-label="Go back"
            title="Back"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => router.forward()}
            className="hidden h-9 min-w-9 items-center justify-center rounded-lg border border-zinc-200 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 sm:flex sm:px-2.5"
            aria-label="Go forward"
            title="Forward"
          >
            →
          </button>
        </div>

        <span className="hidden text-zinc-300 sm:inline">|</span>

        <Link
          href="/"
          className={`rounded-lg px-2 py-1.5 text-sm font-medium transition sm:px-2.5 ${
            pathname === "/"
              ? "bg-indigo-50 text-indigo-700"
              : "text-zinc-600 hover:bg-zinc-50 hover:text-indigo-600"
          }`}
        >
          <span className="sm:hidden">Home</span>
          <span className="hidden sm:inline">Dashboard</span>
        </Link>

        {pathname !== "/" && (
          <>
            <span className="text-zinc-300">/</span>
            <span className="max-w-[7rem] truncate text-sm font-medium text-zinc-900 sm:max-w-none">
              {title}
            </span>
          </>
        )}

        <div className="flex-1" />

        <Link
          href="/"
          className="hidden text-sm font-semibold tracking-tight text-zinc-900 hover:text-indigo-600 sm:inline"
        >
          Doc Editor
        </Link>
      </div>
    </nav>
  );
}
