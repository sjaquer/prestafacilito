import React, { useEffect, useState } from "react";
import { toPng } from "html-to-image";
import { Check, Copy, Download, Loader2, Share2 } from "lucide-react";
import { Modal } from "../ui/Modal";
import { useFeedback } from "../ui/Feedback";
import { hoyISO } from "../../lib/fechas";
import { ReporteCobrosImagen } from "./ReporteCobrosImagen";
import { ItemCobro } from "./tipos";

interface ReporteCobrosModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: ItemCobro[];
}

const dataUrlToBlob = async (dataUrl: string) => (await fetch(dataUrl)).blob();

/** Genera una imagen con los cobros pendientes para enviarla por WhatsApp. */
export const ReporteCobrosModal: React.FC<ReporteCobrosModalProps> = ({ isOpen, onClose, items }) => {
  const { notify } = useFeedback();
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [generando, setGenerando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const nombreArchivo = `Reporte_Cobros_${hoyISO()}.png`;

  useEffect(() => {
    if (!isOpen) return;
    setDataUrl(null);
    setCopiado(false);
    setGenerando(true);
    // Espera a que el contenedor oculto se pinte antes de capturarlo
    const t = setTimeout(async () => {
      try {
        const node = document.getElementById("reporte-cobros-container");
        if (!node) throw new Error("No se encontró el contenido del reporte");
        setDataUrl(await toPng(node, { quality: 0.98, pixelRatio: 2.5, skipFonts: true }));
      } catch (err) {
        console.error("Error al generar el reporte:", err);
        notify("No se pudo generar la imagen del reporte.");
      } finally {
        setGenerando(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [isOpen, notify]);

  const puedeCompartir = typeof navigator !== "undefined" && "canShare" in navigator;

  const compartir = async () => {
    if (!dataUrl) return;
    try {
      const file = new File([await dataUrlToBlob(dataUrl)], nombreArchivo, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Reporte de cobros" });
        return;
      }
      notify("Este dispositivo no permite compartir la imagen. Usa Copiar o Descargar.", "info");
    } catch (err: any) {
      if (err?.name !== "AbortError") notify("No se pudo compartir la imagen.");
    }
  };

  const copiar = async () => {
    if (!dataUrl) return;
    try {
      const blob = await dataUrlToBlob(dataUrl);
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      setCopiado(true);
    } catch {
      notify("Tu navegador no permite copiar imágenes. Usa Descargar.");
    }
  };

  return (
    <>
      {isOpen && (
        <div className="fixed -left-[9999px] -top-[9999px] pointer-events-none" aria-hidden>
          <ReporteCobrosImagen items={items} />
        </div>
      )}
      <Modal isOpen={isOpen} onClose={onClose} title="Reporte de cobros pendientes" size="lg">
        <div className="space-y-4">
          {generando && (
            <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col items-center gap-2 text-xs font-semibold text-slate-600">
              <Loader2 className="w-7 h-7 animate-spin text-emerald-600" /> Generando imagen...
            </div>
          )}
          {dataUrl && (
            <div className="max-h-[50vh] overflow-auto bg-slate-900 p-2 rounded-2xl">
              <img src={dataUrl} alt="Reporte de cobros" className="w-full h-auto rounded-xl" />
            </div>
          )}
          {copiado && (
            <p className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-2.5">
              Imagen copiada. Pégala en el chat de WhatsApp.
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {puedeCompartir && (
              <button
                type="button"
                onClick={compartir}
                disabled={!dataUrl}
                className="h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Share2 className="w-4 h-4" /> Compartir
              </button>
            )}
            <button
              type="button"
              onClick={copiar}
              disabled={!dataUrl}
              className="h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {copiado ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} Copiar
            </button>
            {dataUrl && (
              <a
                href={dataUrl}
                download={nombreArchivo}
                className="h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-bold inline-flex items-center justify-center gap-2 decoration-none"
              >
                <Download className="w-4 h-4" /> Descargar
              </a>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
};
