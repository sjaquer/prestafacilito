import React, { useCallback, useEffect, useState } from "react";
import { FileText, FolderOpen, Loader2, Trash2, Upload } from "lucide-react";
import { Card } from "../ui/Card";
import { useFeedback } from "../ui/Feedback";
import { comprimirImagen } from "../../lib/imageCompression";
import { resolveDocumentUrl } from "../../lib/formatters";

const TIPOS_DOCUMENTO = [
  { value: "DNI", label: "DNI / Documento Identidad" },
  { value: "Recibo de Luz/Agua", label: "Recibo de Luz / Agua" },
  { value: "Contrato Firmado", label: "Contrato Firmado" },
  { value: "Garantía", label: "Garantía / Título" },
  { value: "Otro", label: "Otro Documento" },
];

interface ClienteDocumentosProps {
  clienteId: string;
  driveFolderId?: string | null;
}

/** Documentos del cliente almacenados en Google Drive: listado, subida y eliminación. */
export const ClienteDocumentos: React.FC<ClienteDocumentosProps> = ({ clienteId, driveFolderId }) => {
  const { notify, confirm } = useFeedback();
  const [documentos, setDocumentos] = useState<any[]>([]);
  const [tipoDoc, setTipoDoc] = useState("DNI");
  const [isUploading, setIsUploading] = useState(false);

  const fetchDocumentos = useCallback(async () => {
    try {
      const res = await fetch(`/api/clientes/${clienteId}/documentos`);
      if (res.ok) setDocumentos((await res.json()) || []);
    } catch (err) {
      console.error("Error al cargar documentos:", err);
    }
  }, [clienteId]);

  useEffect(() => {
    fetchDocumentos();
  }, [fetchDocumentos]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const dataUrl = await comprimirImagen(file, 1024, 0.7);
      // Las imágenes se re-codifican como JPEG al comprimirse; el mimeType debe coincidir con el contenido
      const mimeType = dataUrl.match(/^data:([^;]+);/)?.[1] || file.type || "application/octet-stream";

      const res = await fetch(`/api/clientes/${clienteId}/documentos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo_documento: tipoDoc,
          fileName: file.name,
          mimeType,
          base64Data: dataUrl.replace(/^data:[^;]+;base64,/, ""),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "No se pudo subir el documento.");
      }
      notify("Documento subido correctamente", "success");
      await fetchDocumentos();
    } catch (err: any) {
      notify("Error al subir documento: " + (err.message || "Error desconocido"));
    } finally {
      setIsUploading(false);
      input.value = "";
    }
  };

  const handleDelete = async (docId: string) => {
    const ok = await confirm({
      title: "Eliminar documento",
      message: "¿Confirmar que desea eliminar este documento?",
      confirmLabel: "Eliminar",
      danger: true,
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/clientes/${clienteId}/documentos/${docId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("No se pudo eliminar el documento.");
      await fetchDocumentos();
    } catch (err: any) {
      notify(err.message || "Error al eliminar el documento.");
    }
  };

  return (
    <Card variant="simple" className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-black text-slate-900 text-base tracking-tight leading-none flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-600" /> Documentos del Cliente
          </h3>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1.5">
            DNI, Recibos y Contratos almacenados en Google Drive
          </p>
        </div>

        {driveFolderId && (
          <a
            href={`https://drive.google.com/drive/folders/${driveFolderId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
            title="Abrir Carpeta en Google Drive"
          >
            <FolderOpen className="w-3.5 h-3.5" /> Drive
          </a>
        )}
      </div>

      <div className="border-t border-slate-200/80" />

      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
        <span className="font-bold text-slate-700 block text-[11px]">Subir nuevo documento</span>
        <div className="grid grid-cols-2 gap-2">
          <select
            value={tipoDoc}
            onChange={(e) => setTipoDoc(e.target.value)}
            aria-label="Tipo de documento"
            className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none"
          >
            {TIPOS_DOCUMENTO.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>

          <label
            className={`px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs transition-all flex items-center justify-center gap-1.5 ${
              isUploading ? "opacity-60 cursor-wait" : "cursor-pointer"
            }`}
          >
            {isUploading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Subiendo...
              </>
            ) : (
              <>
                <Upload className="w-3.5 h-3.5" /> Seleccionar Archivo
              </>
            )}
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={handleUpload}
              disabled={isUploading}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {documentos.length === 0 ? (
        <div className="p-6 text-center border border-dashed border-slate-200 rounded-xl text-xs text-slate-500 font-medium">
          No hay documentos registrados para este cliente.
        </div>
      ) : (
        <div className="space-y-2">
          {documentos.map((doc) => {
            const url = resolveDocumentUrl(doc);
            return (
              <div
                key={doc.id}
                className="p-2.5 bg-white border border-slate-200 rounded-xl text-xs flex items-center justify-between gap-2 hover:border-indigo-300 transition-all"
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                  <div className="truncate">
                    <span className="font-bold text-slate-800 block truncate">{doc.nombre_archivo}</span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      Tipo: {doc.tipo_documento} • {doc.fecha_subida ? doc.fecha_subida.split("T")[0] : ""}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {url && (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-[10px] cursor-pointer"
                    >
                      Ver
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(doc.id)}
                    className="p-1 text-slate-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                    title="Eliminar Documento"
                    aria-label={`Eliminar ${doc.nombre_archivo}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};
