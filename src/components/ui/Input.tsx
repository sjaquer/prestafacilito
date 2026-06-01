import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helperText?: string;
  required?: boolean;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  required,
  id,
  className = "",
  ...props
}) => {
  const inputId = id || `input-${label.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div className={`flex flex-col gap-1.5 w-full ${className}`}>
      <label 
        htmlFor={inputId} 
        className="text-[11px] md:text-[12px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-0.5"
      >
        <span>{label}</span>
        {required && <span className="text-rose-500 font-bold">*</span>}
      </label>
      
      <input
        id={inputId}
        required={required}
        className={`glass-input w-full px-4 rounded-xl font-medium focus:ring-2 border ${
          error 
            ? "border-rose-500/50 bg-rose-500/[0.02] focus:border-rose-500 focus:ring-rose-500/20" 
            : "border-white/8 focus:border-emerald-500 focus:ring-emerald-500/14"
        }`}
        {...props}
      />
      
      {error ? (
        <span className="text-[10px] md:text-[11px] font-semibold text-rose-400 select-none animate-fadeIn">
          {error}
        </span>
      ) : helperText ? (
        <span className="text-[10px] md:text-[11px] font-medium text-slate-500 select-none">
          {helperText}
        </span>
      ) : null}
    </div>
  );
};
