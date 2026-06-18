import type { Metadata } from "next";
import { Dashboard } from "@/components/dashboard/Dashboard";

export const metadata: Metadata = {
  title: "Doc Editor — Dashboard",
  description: "Browser-based document tools. Edit PDFs and more.",
};

export default function HomePage() {
  return <Dashboard />;
}
