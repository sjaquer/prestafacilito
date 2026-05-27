import React from "react";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "success" | "warning" | "danger" | "info" | "neutral" | "primary";
  icon?: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "neutral",
  icon,
  className = "",
}) => {
  const baseStyles = "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] md:text-[11px] font-black tracking-wider uppercase border select-none w-fit";
  
  const variants = {
    success: "bg-emerald-500/10 border-emerald-500/15 text-emerald-400",
    warning: "bg-amber-500/10 border-amber-500/15 text-amber-400",
    danger: "bg-rose-500/10 border-rose-500/15 text-rose-400",
    info: "bg-sky-500/10 border-sky-500/15 text-sky-400",
    primary: "bg-indigo-500/10 border-indigo-500/15 text-indigo-400",
    neutral: "bg-slate-700/10 border-slate-700/15 text-slate-400",
  };

  return (
    <span className={`${baseStyles} ${variants[variant]} ${className}`}>
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};
