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
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
            aria-label="Go back"
            title="Back"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => router.forward()}
            className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
            aria-label="Go forward"
            title="Forward"
          >
            →
          </button>
        </div>

        <span className="text-zinc-300">|</span>

        <Link
          href="/"
          className={`rounded-lg px-2.5 py-1.5 text-sm font-medium transition ${
            pathname === "/"
              ? "bg-indigo-50 text-indigo-700"
              : "text-zinc-600 hover:bg-zinc-50 hover:text-indigo-600"
          }`}
        >
          Dashboard
        </Link>

        {pathname !== "/" && (
          <>
            <span className="text-zinc-300">/</span>
            <span className="truncate text-sm font-medium text-zinc-900">
              {title}
            </span>
          </>
        )}

        <div className="flex-1" />

        <Link
          href="/"
          className="text-sm font-semibold tracking-tight text-zinc-900 hover:text-indigo-600"
        >
          Doc Editor
        </Link>
      </div>
    </nav>
  );
}
