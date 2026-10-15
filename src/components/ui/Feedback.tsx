import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface FeedbackContextValue {
  notify: (message: string, type?: ToastType) => void;
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

const TOAST_STYLES: Record<ToastType, { box: string; Icon: React.ElementType }> = {
  success: { box: "bg-emerald-50 border-emerald-200 text-emerald-800", Icon: CheckCircle2 },
  error: { box: "bg-rose-50 border-rose-200 text-rose-800", Icon: AlertCircle },
  info: { box: "bg-blue-50 border-blue-200 text-blue-800", Icon: Info },
};

/**
 * Proveedor de avisos (toasts) y diálogos de confirmación.
 * Reemplaza window.alert / window.confirm, que bloquean la página y no siguen el estilo de la app.
 */
export const FeedbackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pending, setPending] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((ok: boolean) => void) | null>(null);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const notify = useCallback(
    (message: string, type: ToastType = "error") => {
      const id = ++nextId.current;
      setToasts((t) => [...t, { id, type, message }]);
      setTimeout(() => dismiss(id), type === "error" ? 7000 : 4000);
    },
    [dismiss]
  );

  const confirm = useCallback((options: ConfirmOptions | string) => {
    resolverRef.current?.(false);
    setPending(typeof options === "string" ? { message: options } : options);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const close = (ok: boolean) => {
    resolverRef.current?.(ok);
    resolverRef.current = null;
    setPending(null);
  };

  return (
    <FeedbackContext.Provider value={{ notify, confirm }}>
      {children}

      {/* Toasts */}
      <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-[70] flex flex-col gap-2 sm:w-96 pointer-events-none">
        <AnimatePresence>
          {toasts.map(({ id, type, message }) => {
            const { box, Icon } = TOAST_STYLES[type];
            return (
              <motion.div
                key={id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                role={type === "error" ? "alert" : "status"}
                className={`pointer-events-auto flex items-start gap-2 p-3 border rounded-xl shadow-lg text-xs font-semibold ${box}`}
              >
                <Icon className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="flex-1 leading-snug">{message}</span>
                <button
                  type="button"
                  onClick={() => dismiss(id)}
                  aria-label="Cerrar aviso"
                  className="opacity-60 hover:opacity-100 bg-transparent border-none cursor-pointer p-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Diálogo de confirmación */}
      <AnimatePresence>
        {pending && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
              onClick={() => close(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="confirm-title"
              onKeyDown={(e) => e.key === "Escape" && close(false)}
              className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-4"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`p-2 rounded-xl shrink-0 ${
                    pending.danger ? "bg-rose-50 text-rose-600" : "bg-indigo-50 text-indigo-600"
                  }`}
                >
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3 id="confirm-title" className="text-sm font-extrabold text-slate-900">
                    {pending.title || "¿Confirmar acción?"}
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">{pending.message}</p>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => close(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                >
                  {pending.cancelLabel || "Cancelar"}
                </button>
                <button
                  type="button"
                  autoFocus
                  onClick={() => close(true)}
                  className={`px-4 py-2 text-white text-xs font-bold rounded-xl transition ${
                    pending.danger ? "bg-rose-600 hover:bg-rose-700" : "bg-indigo-600 hover:bg-indigo-700"
                  }`}
                >
                  {pending.confirmLabel || "Confirmar"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </FeedbackContext.Provider>
  );
};

export const useFeedback = () => {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("useFeedback debe usarse dentro de <FeedbackProvider>");
  return ctx;
};
