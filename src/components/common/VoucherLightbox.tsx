import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, FileText, X } from "lucide-react";
import { parseVoucherUrls, resolveVoucherUrl } from "../../lib/formatters";

interface VoucherLightboxProps {
  /**
   * Comprobantes tal como se guardan en el pago: una URL, o varias (array JSON / separadas por coma).
   * Se muestran todos; null cierra el visor.
   */
  url: string | null;
  onClose: () => void;
}

/** Imagen de un comprobante; si no se puede mostrar (PDF, etc.), ofrece abrir el archivo. */
const Vista: React.FC<{ src: string }> = ({ src }) => {
  const [fallo, setFallo] = useState(false);
  useEffect(() => setFallo(false), [src]);
  return fallo ? (
    <div className="flex flex-col items-center justify-center p-8 text-center space-y-3">
      <FileText className="w-12 h-12 text-slate-400" />
      <p className="text-sm text-slate-600 font-medium">Este archivo no se puede mostrar como imagen.</p>
      <a
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        className="h-11 px-4 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 inline-flex items-center gap-2"
      >
        <ExternalLink className="w-4 h-4" /> Abrir archivo
      </a>
    </div>
  ) : (
    <img src={src} alt="Comprobante de pago" decoding="async" className="max-w-full max-h-full object-contain rounded-xl" onError={() => setFallo(true)} />
  );
};

/**
 * Visor de comprobantes de un pago. Si hay varios, se recorren con flechas, teclado (← →),
 * deslizando el dedo en el celular o tocando las miniaturas.
 */
export const VoucherLightbox: React.FC<VoucherLightboxProps> = ({ url, onClose }) => {
  const urls = useMemo(
    () => (url ? parseVoucherUrls(url).map((u) => resolveVoucherUrl(u)).filter(Boolean) : []),
    [url]
  );
  const [i, setI] = useState(0);
  const toqueX = useRef<number | null>(null);

  useEffect(() => setI(0), [url]);

  const total = urls.length;
  const ir = (paso: number) => setI((actual) => (actual + paso + total) % total);

  useEffect(() => {
    if (!total) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && total > 1) ir(1);
      if (e.key === "ArrowLeft" && total > 1) ir(-1);
    };
    window.addEventListener("keydown", onKey);
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflowPrevio;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, onClose]);

  if (!total) return null;
  const actual = urls[Math.min(i, total - 1)];

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[60] bg-slate-950/85 sm:backdrop-blur-sm flex items-center justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={total > 1 ? `Comprobantes de pago (${total})` : "Comprobante de pago"}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full h-[100dvh] sm:h-auto sm:max-h-[92vh] sm:max-w-2xl sm:rounded-3xl flex flex-col shadow-2xl pt-safe"
      >
        {/* Encabezado */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-slate-100">
          <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-600" />
            {total > 1 ? `Comprobante ${i + 1} de ${total}` : "Comprobante"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="h-11 w-11 -mr-2 rounded-full text-slate-500 hover:bg-slate-100 flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Imagen actual (deslizable) */}
        <div
          className="relative flex-1 min-h-0 sm:min-h-[320px] sm:max-h-[62vh] bg-slate-900/95 sm:bg-slate-50 flex items-center justify-center p-2 overflow-auto"
          onTouchStart={(e) => (toqueX.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (toqueX.current === null || total < 2) return;
            const dx = e.changedTouches[0].clientX - toqueX.current;
            if (Math.abs(dx) > 50) ir(dx < 0 ? 1 : -1);
            toqueX.current = null;
          }}
        >
          <Vista key={actual} src={actual} />
          {total > 1 && (
            <>
              <button
                type="button"
                onClick={() => ir(-1)}
                aria-label="Comprobante anterior"
                className="absolute left-2 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-white/90 shadow-md text-slate-800 flex items-center justify-center hover:bg-white"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                type="button"
                onClick={() => ir(1)}
                aria-label="Comprobante siguiente"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-white/90 shadow-md text-slate-800 flex items-center justify-center hover:bg-white"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}
        </div>

        {/* Miniaturas de todos los comprobantes */}
        {total > 1 && (
          <div className="flex gap-2 px-4 py-3 scroll-x-limpio border-t border-slate-100" role="tablist" aria-label="Todos los comprobantes">
            {urls.map((u, k) => (
              <button
                key={u + k}
                type="button"
                role="tab"
                aria-selected={k === i}
                aria-label={`Ver comprobante ${k + 1}`}
                onClick={() => setI(k)}
                className={`relative h-16 w-16 shrink-0 rounded-xl overflow-hidden border-2 bg-slate-100 flex items-center justify-center ${
                  k === i ? "border-indigo-600" : "border-transparent opacity-70 hover:opacity-100"
                }`}
              >
                <img src={u} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />
                <span className="absolute bottom-0.5 right-0.5 px-1 rounded bg-slate-900/70 text-white text-[10px] font-black">{k + 1}</span>
              </button>
            ))}
          </div>
        )}

        {/* Pie */}
        <div className="flex items-center justify-between gap-2 px-4 sm:px-5 pt-3 pb-safe-3 sm:pb-3 border-t border-slate-100">
          <a
            href={actual}
            target="_blank"
            rel="noopener noreferrer"
            className="h-11 px-3.5 bg-indigo-50 border border-indigo-200 text-indigo-700 text-sm font-bold rounded-xl hover:bg-indigo-100 inline-flex items-center gap-2"
          >
            <ExternalLink className="w-4 h-4" /> Abrir original
          </a>
          <button type="button" onClick={onClose} className="h-11 px-5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-xl">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
