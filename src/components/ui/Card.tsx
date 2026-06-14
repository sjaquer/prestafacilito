import React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: "bento" | "glass" | "simple";
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = "bento",
  hoverable = true,
  className = "",
  ...props
}) => {
  const baseStyles = "rounded-3xl p-5 md:p-6 transition-all duration-300 relative overflow-hidden";
  
  const variants = {
    bento: "bento-card",
    glass: "bg-white/80 border border-slate-200/80 backdrop-blur-md shadow-sm",
    simple: "bg-white border border-slate-200 shadow-sm",
  };

  const hoverStyles = hoverable && variant !== "bento" 
    ? "hover:border-slate-300 hover:bg-slate-50/90 hover:shadow-md transition-all duration-300" 
    : "";

  return (
    <div
      className={`${baseStyles} ${variants[variant]} ${hoverStyles} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
