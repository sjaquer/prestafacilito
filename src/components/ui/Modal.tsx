import React, { useEffect, useId } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useEsMovil } from "../../hooks/useEsMovil";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  /** Línea secundaria bajo el título (ej. nombre del cliente). */
  subtitle?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  footerActions?: React.ReactNode;
}

const ANCHOS = {
  sm: "sm:max-w-md",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
};

// Varios modales pueden estar abiertos a la vez (ej. modal + confirmación): solo se libera el scroll al cerrar el último
let abiertos = 0;

/**
 * Ventana modal. En el celular es una hoja que sube desde abajo (ocupa el ancho, se alcanza con el pulgar
 * y respeta la zona segura del iPhone); en pantallas grandes es un diálogo centrado.
 */
export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, subtitle, children, size = "md", footerActions }) => {
  const esMovil = useEsMovil();
  const tituloId = useId();

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    abiertos++;
    document.body.style.overflow = "hidden";
    return () => {
      abiertos--;
      if (abiertos === 0) document.body.style.overflow = "";
    };
  }, [isOpen]);

  const animacion = esMovil
    ? { initial: { y: "100%" }, animate: { y: 0 }, exit: { y: "100%" } }
    : { initial: { opacity: 0, scale: 0.96, y: 12 }, animate: { opacity: 1, scale: 1, y: 0 }, exit: { opacity: 0, scale: 0.96, y: 12 } };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/50 sm:backdrop-blur-sm"
          />

          <motion.div
            {...animacion}
            transition={esMovil ? { type: "spring", damping: 32, stiffness: 340 } : { duration: 0.2, ease: "easeOut" }}
            className={`relative z-10 w-full ${ANCHOS[size]} bg-white shadow-2xl flex flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl sm:border sm:border-slate-200 max-h-[92dvh] sm:max-h-[90vh]`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={tituloId}
          >
            {/* Asa: indica que es una hoja (solo celular) */}
            <div className="sm:hidden flex justify-center pt-2.5 pb-1" aria-hidden>
              <span className="w-10 h-1.5 rounded-full bg-slate-200" />
            </div>

            <div className="flex items-start justify-between gap-3 px-5 sm:px-6 pt-2 pb-3 sm:py-4 border-b border-slate-100">
              <div className="min-w-0">
                <h2 id={tituloId} className="text-base font-black text-slate-900 tracking-tight leading-tight">
                  {title}
                </h2>
                {subtitle && <p className="text-xs font-semibold text-slate-500 truncate mt-0.5">{subtitle}</p>}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="h-10 w-10 -mr-2 shrink-0 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-800 flex items-center justify-center"
                aria-label="Cerrar"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-5 sm:px-6 py-4 sm:py-5 text-slate-700">{children}</div>

            {/* Pie: en el celular, botones a lo ancho y la acción principal arriba */}
            {footerActions ? (
              <div className="px-5 sm:px-6 pt-3 pb-safe-3 sm:py-4 border-t border-slate-100 bg-slate-50 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 [&>*]:w-full sm:[&>*]:w-auto">
                {footerActions}
              </div>
            ) : (
              <div className="sm:hidden pb-safe" />
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
