import React from "react";

interface LoadingSkeletonProps {
  variant?: "card" | "table" | "list" | "kpi";
  rows?: number;
  className?: string;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  variant = "card",
  rows = 3,
  className = "",
}) => {
  const shimmerClass = "relative overflow-hidden bg-white/[0.03] before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/[0.04] before:to-transparent border border-white/[0.04]";

  if (variant === "kpi") {
    return (
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 ${className}`}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className={`rounded-3xl p-5 md:p-6 ${shimmerClass} h-28`}>
            <div className="h-4 bg-white/5 rounded-md w-1/2 mb-3" />
            <div className="h-8 bg-white/5 rounded-md w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === "table") {
    return (
      <div className={`w-full rounded-3xl p-6 ${shimmerClass} ${className}`}>
        <div className="h-6 bg-white/5 rounded-md w-1/4 mb-6" />
        <div className="space-y-4">
          <div className="h-8 bg-white/5 rounded-md w-full" />
          {[...Array(rows)].map((_, i) => (
            <div key={i} className="h-12 bg-white/5 rounded-md w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (variant === "list") {
    return (
      <div className={`space-y-3 ${className}`}>
        {[...Array(rows)].map((_, i) => (
          <div key={i} className={`rounded-2xl p-4 flex items-center justify-between ${shimmerClass}`}>
            <div className="space-y-2 w-1/2">
              <div className="h-4 bg-white/5 rounded-md w-3/4" />
              <div className="h-3 bg-white/5 rounded-md w-1/2" />
            </div>
            <div className="h-6 bg-white/5 rounded-md w-16" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`rounded-3xl p-6 ${shimmerClass} h-48 ${className}`}>
      <div className="h-5 bg-white/5 rounded-md w-1/3 mb-4" />
      <div className="h-4 bg-white/5 rounded-md w-full mb-2" />
      <div className="h-4 bg-white/5 rounded-md w-5/6 mb-4" />
      <div className="h-10 bg-white/5 rounded-xl w-24" />
    </div>
  );
};
