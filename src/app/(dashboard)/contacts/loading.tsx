import { Loader2 } from "lucide-react";

export default function ContactsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 animate-pulse rounded-md bg-slate-800" />
        <div className="flex gap-2">
          <div className="h-10 w-24 animate-pulse rounded-md bg-slate-800" />
          <div className="h-10 w-24 animate-pulse rounded-md bg-slate-800" />
        </div>
      </div>
      <div className="h-12 w-full animate-pulse rounded-md bg-slate-800" />
      <div className="rounded-lg border border-border">
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading your contacts...</p>
        </div>
      </div>
    </div>
  );
}
