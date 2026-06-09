import type { Metadata } from "next";
import { DashboardShell } from "./dashboard-shell";
import { createClient } from "@/lib/supabase/server";
import { BrandingProvider } from "@/hooks/use-account-branding";
import { ActingAsBanner } from "@/components/layout/acting-as-banner";

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
    <>
      <ActingAsBanner />
      <DashboardShell initialUser={user} initialProfile={profile}>
        <BrandingProvider />
        {children}
      </DashboardShell>
    </>
  );
}
