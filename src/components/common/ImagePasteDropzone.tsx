import React, { useState, useEffect, useRef } from "react";
import { Upload, Image as ImageIcon, X, ShieldCheck } from "lucide-react";

interface ImagePasteDropzoneProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  maxFiles?: number;
  label?: string;
  sublabel?: string;
}

export const ImagePasteDropzone: React.FC<ImagePasteDropzoneProps> = ({
  files,
  onFilesChange,
  maxFiles = 5,
  label = "Comprobante / Voucher (opcional)",
  sublabel = "Haz clic, arrastra tu imagen o presiona Ctrl+V para pegar voucher"
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [previews, setPreviews] = useState<string[]>([]);
  const dropzoneRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generar URLs de vista previa para las imágenes recibidas
  useEffect(() => {
    const newPreviews = files.map((file) => {
      if (file.type.startsWith("image/")) {
        return URL.createObjectURL(file);
      }
      return "";
    });
    setPreviews(newPreviews);

    return () => {
      newPreviews.forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, [files]);

  // Listener global de pegado (Ctrl+V) cuando el modal/formulario está activo
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      const clipboardItems = e.clipboardData?.items;
      if (!clipboardItems) return;

      const newPastedFiles: File[] = [];
      for (let i = 0; i < clipboardItems.length; i++) {
        const item = clipboardItems[i];
        if (item.type.indexOf("image") !== -1) {
          const blob = item.getAsFile();
          if (blob) {
            const fileName = `voucher_pega_${Date.now()}_${i + 1}.${blob.type.split("/")[1] || "png"}`;
            const file = new File([blob], fileName, { type: blob.type });
            newPastedFiles.push(file);
          }
        }
      }

      if (newPastedFiles.length > 0) {
        e.preventDefault();
        const updated = [...files, ...newPastedFiles].slice(0, maxFiles);
        onFilesChange(updated);
      }
    };

    window.addEventListener("paste", handleGlobalPaste);
    return () => {
      window.removeEventListener("paste", handleGlobalPaste);
    };
  }, [files, maxFiles, onFilesChange]);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = Array.from(e.target.files);
      const updated = [...files, ...selected].slice(0, maxFiles);
      onFilesChange(updated);
      e.target.value = "";
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
      if (droppedFiles.length > 0) {
        const updated = [...files, ...droppedFiles].slice(0, maxFiles);
        onFilesChange(updated);
      }
    }
  };

  const handleRemoveFile = (index: number) => {
    const updated = files.filter((_, i) => i !== index);
    onFilesChange(updated);
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-slate-700 block">
        {label}
      </label>

      {/* Zona Drag & Drop / Click / Paste */}
      <div
        ref={dropzoneRef}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all ${
          isDragging
            ? "border-emerald-500 bg-emerald-50/70 scale-[0.99]"
            : "border-slate-200 hover:border-emerald-400 bg-slate-50/60 hover:bg-white"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileInputChange}
        />

        <div className="flex flex-col items-center justify-center space-y-1.5 pointer-events-none select-none">
          <div className="w-10 h-10 rounded-xl bg-emerald-100/70 flex items-center justify-center text-emerald-700">
            <Upload className="w-5 h-5" />
          </div>
          <p className="text-xs font-bold text-slate-700">
            {sublabel}
          </p>
          <p className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Formatos aceptados: PNG, JPG, WEBP • Pegado directo disponible con Ctrl+V</span>
          </p>
        </div>
      </div>

      {/* Lista de Miniaturas / Archivos Cargados */}
      {files.length > 0 && (
        <div className="grid grid-cols-2 gap-2 pt-1">
          {files.map((file, idx) => (
            <div
              key={idx}
              className="relative flex items-center gap-2 p-2 bg-slate-100/80 border border-slate-200 rounded-xl overflow-hidden group"
            >
              {previews[idx] ? (
                <img
                  src={previews[idx]}
                  alt="Voucher Preview"
                  className="w-9 h-9 object-cover rounded-lg border border-slate-300"
                />
              ) : (
                <div className="w-9 h-9 bg-slate-200 rounded-lg flex items-center justify-center text-slate-500">
                  <ImageIcon className="w-4 h-4" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-slate-800 truncate">{file.name}</p>
                <p className="text-[9.5px] text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveFile(idx);
                }}
                className="w-6 h-6 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 flex items-center justify-center transition-colors"
                title="Eliminar archivo"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
