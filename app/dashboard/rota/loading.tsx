import { Skeleton } from "@/components/ui/skeleton";

export default function RotaLoading() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-10 w-10 rounded-xl" />
        <Skeleton className="h-10 w-44 rounded-xl" />
      </div>
      {/* Grid skeleton */}
      <Skeleton className="h-[400px] w-full rounded-lg" />
    </div>
  );
}
