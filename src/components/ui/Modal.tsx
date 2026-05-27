import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  footerActions?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
  footerActions,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  // Cierre por tecla ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Bloquear scroll de página al abrir modal
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const sizes = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            ref={modalRef}
            className={`w-full bg-[#0d1120] border border-white/[0.07] rounded-3xl shadow-2xl relative z-10 flex flex-col max-h-[90vh] overflow-hidden ${sizes[size]} modal-mobile-full`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4.5 border-b border-white/[0.05]">
              <h3 
                id="modal-title" 
                className="text-sm md:text-base font-black text-white tracking-tight"
              >
                {title}
              </h3>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 transition-all cursor-pointer"
                title="Cerrar modal"
                aria-label="Cerrar modal"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 text-slate-300">
              {children}
            </div>

            {/* Footer */}
            {footerActions && (
              <div className="px-6 py-4 border-t border-white/[0.05] bg-black/20 flex justify-end items-center gap-3">
                {footerActions}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
