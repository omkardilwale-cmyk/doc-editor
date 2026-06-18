import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppNavBar } from "@/components/layout/AppNavBar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Doc Editor",
  description: "Browser-based document tools for editing PDFs and more.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full bg-zinc-50 antialiased`}
    >
      <body className="flex min-h-full flex-col overflow-x-hidden bg-zinc-50 text-zinc-900">
        <AppNavBar />
        {children}
      </body>
    </html>
  );
}
