import React from "react";
import { Loader2 } from "lucide-react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "glow" | "danger" | "success" | "warning";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = "secondary",
  size = "md",
  loading = false,
  icon,
  className = "",
  disabled,
  ...props
}) => {
  const baseStyles = "inline-flex items-center justify-center gap-2 font-bold tracking-wide transition-all duration-200 rounded-xl cursor-pointer select-none active:scale-[0.98] disabled:active:scale-100 disabled:opacity-50 disabled:cursor-not-allowed border";
  
  const variants = {
    primary: "btn-primary border-indigo-500/20 text-white shadow-lg shadow-indigo-500/10",
    secondary: "bg-white/5 border-white/10 hover:bg-white/10 text-slate-300 hover:text-white hover:border-white/15",
    glow: "glow-btn bg-white/5 border-white/10 hover:bg-white/12 text-white",
    danger: "bg-rose-500/10 border-rose-500/20 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 hover:border-rose-500/30",
    success: "bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 hover:border-emerald-500/30",
    warning: "bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 hover:border-amber-500/30",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs min-h-[38px] md:min-h-[44px]", // Asegura tamaño táctil mínimo en responsive
    md: "px-4.5 py-2.5 text-xs md:text-sm min-h-[44px]",
    lg: "px-6 py-3.5 text-sm md:text-base min-h-[48px] md:min-h-[52px]",
  };

  return (
    <button
      disabled={disabled || loading}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 className="animate-spin shrink-0" size={size === "sm" ? 14 : 16} />
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      <span>{children}</span>
    </button>
  );
};
