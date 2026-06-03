import type { Metadata } from "next";
import { cookies } from "next/headers";
import { DashboardShell } from "./dashboard-shell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await cookies();
  return <DashboardShell>{children}</DashboardShell>;
}
