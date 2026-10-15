import React, { useEffect, useState } from "react";
import { FileText, ExternalLink, X } from "lucide-react";

interface VoucherLightboxProps {
  url: string | null;
  onClose: () => void;
}

/** Visor de comprobantes: muestra la imagen y, si no puede renderizarse (PDF, etc.), ofrece abrir el archivo. */
export const VoucherLightbox: React.FC<VoucherLightboxProps> = ({ url, onClose }) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [url]);

  useEffect(() => {
    if (!url) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [url, onClose]);

  if (!url) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
      role="dialog"
      aria-modal="true"
      aria-label="Comprobante de pago"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl p-5 max-w-xl w-full space-y-3 shadow-2xl relative cursor-default animate-scaleUp"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-indigo-600" /> Comprobante de Pago
          </h4>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[65vh] min-h-[220px] overflow-y-auto flex items-center justify-center bg-slate-50 rounded-2xl p-2 border border-slate-200/80">
          {failed ? (
            <div className="flex flex-col items-center justify-center p-8 text-center space-y-3">
              <FileText className="w-12 h-12 text-slate-400" />
              <p className="text-xs text-slate-600 font-medium">
                El archivo no se puede previsualizar directamente como imagen.
              </p>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-xs hover:bg-indigo-700 transition-colors inline-flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Abrir / Descargar Archivo
              </a>
            </div>
          ) : (
            <img
              src={url}
              alt="Comprobante de pago"
              className="max-w-full h-auto rounded-xl object-contain shadow-xs"
              onError={() => setFailed(true)}
            />
          )}
        </div>

        <div className="flex items-center justify-between pt-2">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold rounded-xl hover:bg-indigo-100 transition-all inline-flex items-center gap-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Abrir en pestaña nueva
          </a>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
