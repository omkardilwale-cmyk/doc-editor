import type { ReactNode } from "react";

interface ToolChromeProps {
  children: ReactNode;
}

/** Wraps tool pages — global back/forward nav lives in AppNavBar. */
export function ToolChrome({ children }: ToolChromeProps) {
  return <div className="flex min-h-0 flex-1 flex-col">{children}</div>;
}
