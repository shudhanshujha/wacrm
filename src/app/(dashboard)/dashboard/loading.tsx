import { Skeleton, SkeletonCard } from "@/components/dashboard/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <div className="h-8 w-48 animate-pulse rounded-md bg-slate-800" />
        <div className="mt-2 h-4 w-96 animate-pulse rounded-md bg-slate-800" />
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Skeleton className="h-[400px] w-full" />
        </div>
        <div className="lg:col-span-2">
          <Skeleton className="h-[400px] w-full" />
        </div>
      </div>

      {/* Response time */}
      <Skeleton className="h-[300px] w-full" />

      {/* Agent Performance */}
      <Skeleton className="h-[300px] w-full" />

      {/* Activity feed */}
      <div className="space-y-3">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}
