import type { Metadata } from "next";
import { cookies } from "next/headers";
import { DashboardShell } from "./dashboard-shell";
import { createClient } from "@/lib/supabase/server";

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
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  let profile = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url, role, beta_features")
      .eq("user_id", user.id)
      .maybeSingle();
    profile = data;
  }

  return (
    <DashboardShell initialUser={user} initialProfile={profile}>
      {children}
    </DashboardShell>
  );
}
