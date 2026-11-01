import React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /** Se conservan por compatibilidad; todas usan hoy la misma superficie del diseño nuevo. */
  variant?: "bento" | "glass" | "simple";
  hoverable?: boolean;
}

/** Superficie blanca estándar (misma que Panel y las tarjetas de lista). Sin "saltos" al pasar el mouse. */
export const Card: React.FC<CardProps> = ({ children, variant: _variant, hoverable = false, className = "", ...props }) => (
  <div
    className={`bg-white border border-slate-200/80 rounded-2xl shadow-sm p-4 sm:p-5 relative ${
      hoverable ? "hover:border-slate-300 transition-colors" : ""
    } ${className}`}
    {...props}
  >
    {children}
  </div>
);
