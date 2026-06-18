import Link from "next/link";
import { TOOLS } from "@/config/tools";

export function Dashboard() {
  const availableTools = TOOLS.filter((tool) => tool.available);

  return (
    <div className="min-h-full bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6 sm:py-5">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
              Doc Editor
            </h1>
            <p className="mt-0.5 text-sm text-zinc-500">
              Browser-based document tools
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <section>
          <h2 className="text-lg font-semibold text-zinc-900">Tools</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Pick a tool to get started. More utilities will be added here over
            time.
          </p>

          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {availableTools.map((tool) => (
              <li key={tool.id}>
                <Link
                  href={tool.href}
                  className="group flex h-full flex-col rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md"
                >
                  <div className="flex items-start gap-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-xs font-bold text-indigo-700">
                      {tool.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-zinc-900 group-hover:text-indigo-700">
                        {tool.name}
                      </h3>
                      <p className="mt-1 text-sm leading-relaxed text-zinc-500">
                        {tool.description}
                      </p>
                      <p className="mt-3 text-xs font-medium text-indigo-600">
                        Open tool →
                      </p>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
