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
    primary: "btn-primary border-emerald-600/20 text-white shadow-lg shadow-emerald-600/10",
    secondary: "bg-slate-100 border-slate-200 hover:bg-slate-200/80 text-slate-700 hover:text-slate-900 hover:border-slate-300/80",
    glow: "glow-btn bg-white border-slate-200 hover:bg-slate-50 text-slate-800 hover:text-slate-900",
    danger: "bg-rose-50 border-rose-200 hover:bg-rose-100 text-rose-700 hover:text-rose-900 hover:border-rose-300",
    success: "bg-emerald-50 border-emerald-200 hover:bg-emerald-100 text-emerald-700 hover:text-emerald-900 hover:border-emerald-300",
    warning: "bg-amber-50 border-amber-200 hover:bg-amber-100 text-amber-700 hover:text-amber-900 hover:border-amber-300",
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
