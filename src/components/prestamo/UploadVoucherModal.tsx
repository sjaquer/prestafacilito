import React, { useState, useEffect } from "react";
import { Upload, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { ImagePasteDropzone } from "../common/ImagePasteDropzone";
import { subirVoucher } from "../../lib/imageCompression";
import { formatCurrency, formatDateShort } from "../../lib/formatters";

interface UploadVoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  pagos: any[];
  initialPago?: any | null;
  onUploaded: () => void;
}

const parseUrls = (field: string | null | undefined): string[] => {
  if (!field) return [];
  try {
    if (field.startsWith("[")) {
      const arr = JSON.parse(field);
      return Array.isArray(arr) ? arr.filter(Boolean) : [field];
    }
  } catch {
    // ignore
  }
  return [field];
};

export const UploadVoucherModal: React.FC<UploadVoucherModalProps> = ({
  isOpen,
  onClose,
  pagos,
  initialPago,
  onUploaded
}) => {
  const [selectedPagoId, setSelectedPagoId] = useState<string>("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setSelectedPagoId(initialPago?.id || "");
    setFiles([]);
    setErrorMsg("");
    setSuccessMsg("");
  }, [isOpen, initialPago]);

  const selectedPago = pagos.find((p) => p.id === selectedPagoId);

  const handleSubmit = async () => {
    if (!selectedPagoId) {
      setErrorMsg("Debes seleccionar el pago al que corresponde el voucher.");
      return;
    }
    if (files.length === 0) {
      setErrorMsg("Debes adjuntar al menos un comprobante (imagen o archivo).");
      return;
    }

    setUploading(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const urls: string[] = [];
      const ids: string[] = [];
      for (const file of files) {
        const result = await subirVoucher(file);
        if (result.url) urls.push(result.url);
        if (result.driveFileId) ids.push(result.driveFileId);
      }

      if (urls.length === 0) throw new Error("No se pudo subir el comprobante a Google Drive.");

      const prevUrls = parseUrls(selectedPago?.comprobante_url);
      const prevIds = parseUrls(selectedPago?.voucher_drive_file_id);
      const mergedUrls = [...prevUrls, ...urls];
      const mergedIds = [...prevIds, ...ids];

      const res = await fetch(`/api/amortizaciones/${selectedPagoId}/voucher`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comprobante_url: mergedUrls.length === 1 ? mergedUrls[0] : JSON.stringify(mergedUrls),
          voucher_drive_file_id: mergedIds.length === 1 ? mergedIds[0] : JSON.stringify(mergedIds)
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "No se pudo vincular el comprobante al pago.");
      }

      setSuccessMsg("¡Comprobante adjuntado correctamente al pago!");
      onUploaded();
      setTimeout(() => onClose(), 900);
    } catch (err: any) {
      setErrorMsg(err.message || "Ocurrió un error al subir el voucher.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Subir Voucher / Comprobante"
      size="md"
      footerActions={
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={uploading}>
            Cancelar
          </Button>
          <Button variant="primary" size="sm" onClick={handleSubmit} loading={uploading} icon={<Upload size={14} />}>
            Adjuntar Comprobante
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {pagos.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] md:text-[11px] font-black text-slate-500 uppercase tracking-wider pl-0.5">
              Pago Destino
            </label>
            <select
              value={selectedPagoId}
              onChange={(e) => setSelectedPagoId(e.target.value)}
              className="glass-input w-full px-4 rounded-xl border border-slate-200 font-bold bg-white text-slate-800 cursor-pointer h-12 text-xs"
            >
              <option value="">-- Seleccionar pago --</option>
              {pagos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.cliente_nombre} · {formatDateShort(p.fecha_pago)} · {formatCurrency(p.monto)}
                </option>
              ))}
            </select>
          </div>
        )}

        {selectedPago && (
          <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs">
            <span className="font-bold text-slate-600">
              {selectedPago.cliente_nombre} · {formatDateShort(selectedPago.fecha_pago)}
            </span>
            <span className="font-mono font-black text-emerald-700">{formatCurrency(selectedPago.monto)}</span>
          </div>
        )}

        <ImagePasteDropzone files={files} onFilesChange={setFiles} maxFiles={5} />

        {errorMsg && (
          <div className="flex items-center gap-2 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
            <AlertCircle size={14} className="shrink-0" /> {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
            <CheckCircle2 size={14} className="shrink-0" /> {successMsg}
          </div>
        )}
        {uploading && (
          <div className="flex items-center justify-center gap-2 text-xs font-bold text-indigo-600">
            <Loader2 size={14} className="animate-spin" /> Subiendo comprobante a Google Drive...
          </div>
        )}
      </div>
    </Modal>
  );
};

export default UploadVoucherModal;