import React, { useId, useState } from "react";
import { ChevronDown } from "lucide-react";

interface CollapsibleSectionProps {
  title: string;
  icon?: React.ReactNode;
  /** Texto o elemento corto a la derecha del título (ej. contador, monto). */
  aside?: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * Tarjeta con encabezado que pliega/despliega su contenido.
 * El contenido se mantiene montado al plegar, así los formularios no pierden lo escrito.
 */
export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  icon,
  aside,
  defaultOpen = false,
  className = "",
  children,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <section className={`bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={contentId}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left bg-transparent border-none cursor-pointer hover:bg-slate-50/70 transition-colors min-h-[52px]"
      >
        {icon && <span className="p-1.5 rounded-lg bg-slate-100 text-slate-600 shrink-0 flex">{icon}</span>}
        <span className="flex-1 text-sm font-extrabold text-slate-800 leading-tight">{title}</span>
        {aside && <span className="text-xs font-bold text-slate-500 shrink-0">{aside}</span>}
        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div id={contentId} hidden={!open} className="px-4 pb-4 pt-1 border-t border-slate-100">
        {children}
      </div>
    </section>
  );
};
