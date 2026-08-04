import React, { useState, useEffect, useRef } from "react";
import { Upload, Paperclip, CheckCircle2, AlertCircle, Loader2, X } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Cliente, TipoDocumento, TIPOS_DOCUMENTO_CONFIG, ACCEPT_DOCUMENTOS } from "../../types";

interface UploadDocumentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  cliente: Cliente | null;
  onUpload: (
    clienteId: string,
    documentData: { fileName: string; mimeType: string; base64Data: string; tipo_documento: string; observacion?: string }
  ) => Promise<{ success: boolean; error?: string }>;
  onUploaded: () => void;
}

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export const UploadDocumentoModal: React.FC<UploadDocumentoModalProps> = ({
  isOpen,
  onClose,
  cliente,
  onUpload,
  onUploaded
}) => {
  const [tipoDocumento, setTipoDocumento] = useState<TipoDocumento>("dni_frontal");
  const [files, setFiles] = useState<File[]>([]);
  const [observacion, setObservacion] = useState("");
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setTipoDocumento("dni_frontal");
    setFiles([]);
    setObservacion("");
    setErrorMsg("");
    setSuccessMsg("");
  }, [isOpen]);

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files as FileList)].slice(0, 5));
      e.target.value = "";
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!cliente) return;
    if (files.length === 0) {
      setErrorMsg("Debes seleccionar al menos un archivo.");
      return;
    }
    setUploading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      let okCount = 0;
      for (const file of files) {
        const base64Data = await fileToBase64(file);
        const res = await onUpload(cliente.id, {
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          base64Data,
          tipo_documento: tipoDocumento,
          observacion: observacion || undefined
        });
        if (res.success) okCount++;
      }

      if (okCount > 0) {
        setSuccessMsg(`Se subieron ${okCount} documento(s) correctamente a Google Drive.`);
        onUploaded();
        setTimeout(() => onClose(), 900);
      } else {
        setErrorMsg("No se pudo subir ningún documento.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Ocurrió un error al subir el documento.");
    } finally {
      setUploading(false);
    }
  };

  const conf = TIPOS_DOCUMENTO_CONFIG[tipoDocumento];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Subir Documento — ${cliente?.nombre_completo || ""}`}
      size="md"
      footerActions={
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={uploading}>
            Cancelar
          </Button>
          <Button variant="primary" size="sm" onClick={handleSubmit} loading={uploading} icon={<Upload size={14} />}>
            Subir a Google Drive
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] md:text-[11px] font-black text-slate-500 uppercase tracking-wider pl-0.5">
            Clasificación del Documento
          </label>
          <select
            value={tipoDocumento}
            onChange={(e) => setTipoDocumento(e.target.value as TipoDocumento)}
            className="glass-input w-full px-4 rounded-xl border border-slate-200 font-bold bg-white text-slate-800 cursor-pointer h-12 text-xs"
          >
            {(Object.keys(TIPOS_DOCUMENTO_CONFIG) as TipoDocumento[]).map((t) => (
              <option key={t} value={t}>
                {TIPOS_DOCUMENTO_CONFIG[t].icon} {TIPOS_DOCUMENTO_CONFIG[t].label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[10px] md:text-[11px] font-black text-slate-500 uppercase tracking-wider pl-0.5 block mb-1.5">
            Archivos ({files.length}/5)
          </label>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full border-2 border-dashed border-slate-200 hover:border-emerald-400 bg-slate-50/60 hover:bg-white rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-100/70 flex items-center justify-center text-emerald-700">
              <Paperclip className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-slate-700">Seleccionar o arrastrar documentos</p>
            <p className="text-[11px] text-slate-400 font-medium">
              Acepta imágenes, PDF y Word ({getAcceptLabel(conf.accept)})
            </p>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT_DOCUMENTOS}
            multiple
            className="hidden"
            onChange={handleFilesChange}
          />
        </div>

        {files.length > 0 && (
          <div className="space-y-1.5">
            {files.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 p-2 bg-slate-100/80 border border-slate-200 rounded-xl"
              >
                <Paperclip size={14} className="text-indigo-500 shrink-0" />
                <span className="flex-1 min-w-0 text-[11px] font-bold text-slate-800 truncate">{file.name}</span>
                <span className="text-[9.5px] text-slate-500">{(file.size / 1024).toFixed(1)} KB</span>
                <button
                  type="button"
                  onClick={() => removeFile(idx)}
                  className="w-6 h-6 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 flex items-center justify-center"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] md:text-[11px] font-black text-slate-500 uppercase tracking-wider pl-0.5">
            Observación (opcional)
          </label>
          <input
            type="text"
            value={observacion}
            onChange={(e) => setObservacion(e.target.value)}
            placeholder="Ej. DNI adjuntado en recepción"
            className="glass-input w-full px-4 rounded-xl border border-slate-200 font-bold bg-white text-slate-800 h-12 text-xs"
          />
        </div>

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
            <Loader2 size={14} className="animate-spin" /> Subiendo a Google Drive...
          </div>
        )}
      </div>
    </Modal>
  );
};

export default UploadDocumentoModal;

function getAcceptLabel(accept: string): string {
  return accept
    .split(",")
    .map((a) => a.trim().replace("image/*", "Imagen").replace("application/pdf", "PDF"))
    .filter((a) => a && a !== ".doc" && a !== ".docx")
    .join(", ") || "varios formatos";
}