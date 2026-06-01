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
    glass: "bg-[#0d1224]/45 border border-white/[0.08] backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
    simple: "bg-[#080c16] border border-white/[0.05] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
  };

  const hoverStyles = hoverable && variant !== "bento" 
    ? "hover:border-white/[0.09] hover:bg-[#0c1020]/60 hover:shadow-lg hover:shadow-black/20" 
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
