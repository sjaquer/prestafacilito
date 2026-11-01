import React, { useEffect, useId } from "react";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Oculta el título visualmente (sigue disponible para lectores de pantalla). */
  ocultarTitulo?: boolean;
}

/** Hoja que sube desde abajo, para menús y acciones en el celular. Se cierra tocando fuera, con la X o con Escape. */
export const BottomSheet: React.FC<BottomSheetProps> = ({ open, onClose, title, children, ocultarTitulo }) => {
  const tituloId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflowPrevio;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-labelledby={tituloId}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-950/50"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 340 }}
            className="absolute inset-x-0 bottom-0 bg-white rounded-t-3xl max-h-[88dvh] overflow-y-auto overscroll-contain pb-safe-3 shadow-2xl"
          >
            <div className="sticky top-0 z-10 bg-white rounded-t-3xl">
              <div className="flex justify-center pt-2.5" aria-hidden>
                <span className="w-10 h-1.5 rounded-full bg-slate-200" />
              </div>
              <div className="flex items-center justify-between px-5 pt-1 pb-2">
                <h2 id={tituloId} className={ocultarTitulo ? "sr-only" : "text-base font-black text-slate-900"}>
                  {title}
                </h2>
                <button
                  type="button"
                  onClick={onClose}
                  className="h-10 w-10 -mr-2 ml-auto rounded-full text-slate-500 hover:bg-slate-100 flex items-center justify-center"
                  aria-label="Cerrar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="px-4 pb-2">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
