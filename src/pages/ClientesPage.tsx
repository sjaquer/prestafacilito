import React, { useState, useRef } from "react";
import { UserPlus, Users, Loader2, X, Upload, FileText, Eye, Trash2 } from "lucide-react";
import { useClientes } from "../hooks/useClientes";
import { Cliente, TipoDocumento, TIPOS_DOCUMENTO_CONFIG, ACCEPT_DOCUMENTOS } from "../types";
import { Card } from "../components/ui/Card";
import { Modal } from "../components/ui/Modal";
import { ClientList } from "../components/cliente/ClientList";
import { ClientForm } from "../components/cliente/ClientForm";

export const ClientesPage: React.FC = () => {
  const {
    clientes,
    loading,
    error: apiError,
    createCliente,
    updateCliente,
    uploadClienteDocument,
    deleteClienteDocument,
    fetchClienteDocuments
  } = useClientes();

  const [formLoading, setFormLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Edit Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [editDocs, setEditDocs] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [selectedDocTipo, setSelectedDocTipo] = useState<TipoDocumento>("dni_frontal");
  const editFileInputRef = useRef<HTMLInputElement>(null);
  
  // Lightbox Preview Doc State
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);

  // Helper to convert file to base64
  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  // Handle Create Client
  const handleCreateClient = async (payload: any, files: { tipo: TipoDocumento; file: File }[]) => {
    setFormLoading(true);
    setSuccessMsg("");
    setErrorMsg("");
    
    try {
      const result = await createCliente(payload);
      if (result.success && result.cliente) {
        const createdId = result.cliente.id;
        
        // Proactively upload supporting documents if present
        if (files.length > 0) {
          for (const item of files) {
            try {
              const base64Data = await fileToBase64(item.file);
              await uploadClienteDocument(createdId, {
                fileName: item.file.name,
                mimeType: item.file.type || "application/octet-stream",
                base64Data,
                tipo_documento: item.tipo
              });
            } catch (docErr) {
              console.error("Error al subir documento durante registro:", docErr);
            }
          }
        }
        
        setSuccessMsg("Cliente registrado correctamente ✅");
        setTimeout(() => setSuccessMsg(""), 4000);
      } else {
        setErrorMsg(result.error || "No se pudo registrar el cliente.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Error al crear cliente.");
    } finally {
      setFormLoading(false);
    }
  };

  // Open Edit Client Modal & Fetch Docs
  const handleOpenEditModal = async (cliente: Cliente) => {
    setSelectedCliente(cliente);
    setShowEditModal(true);
    setLoadingDocs(true);
    setEditDocs([]);
    
    try {
      const docs = await fetchClienteDocuments(cliente.id);
      setEditDocs(docs || []);
    } catch (err) {
      console.error("Error al obtener documentos:", err);
    } finally {
      setLoadingDocs(false);
    }
  };

  // Handle Update Client
  const handleUpdateClientSubmit = async (payload: any) => {
    if (!selectedCliente) return;
    setFormLoading(true);
    setErrorMsg("");

    try {
      const result = await updateCliente(selectedCliente.id, payload);
      if (result.success) {
        setShowEditModal(false);
        setSelectedCliente(null);
      } else {
        setErrorMsg(result.error || "No se pudo actualizar el cliente.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Error al actualizar cliente.");
    } finally {
      setFormLoading(false);
    }
  };

  // Upload Doc in edit mode (Immediate upload)
  const handleEditUploadDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedCliente) return;

    setUploadingDoc(true);
    try {
      const base64Data = await fileToBase64(file);
      const result = await uploadClienteDocument(selectedCliente.id, {
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        base64Data,
        tipo_documento: selectedDocTipo
      });

      if (result.success && result.documento) {
        setEditDocs(prev => [result.documento, ...prev]);
      } else {
        alert(result.error || "Error al cargar el archivo soporte.");
      }
    } catch (err) {
      console.error("Error en carga de documento:", err);
    } finally {
      setUploadingDoc(false);
      e.target.value = "";
    }
  };

  // Delete Doc in edit mode
  const handleDeleteDoc = async (docId: string) => {
    if (!selectedCliente || !confirm("¿Seguro que deseas eliminar este documento de soporte?")) return;
    
    try {
      const result = await deleteClienteDocument(selectedCliente.id, docId);
      if (result.success) {
        setEditDocs(prev => prev.filter(d => d.id !== docId));
      } else {
        alert(result.error || "No se pudo eliminar el documento.");
      }
    } catch (err) {
      console.error("Error al eliminar documento:", err);
    }
  };

  const getMimeIcon = (mime: string) => {
    if (mime.startsWith("image/")) return "🖼️";
    if (mime === "application/pdf") return "📄";
    return "📎";
  };

  const getAvatarGradient = (name: string) => {
    const gradients = [
      "from-indigo-500 to-violet-600",
      "from-emerald-500 to-teal-600",
      "from-amber-500 to-orange-505"
    ];
    return gradients[name.charCodeAt(0) % gradients.length];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1.5 select-none">
          <div className="w-1.5 h-5 bg-indigo-600 rounded-full" />
          <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">Directorio</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight leading-none">
          Gestión de Clientes
        </h1>
        <p className="text-xs text-slate-500 font-semibold mt-1">
          {clientes.length} cliente{clientes.length !== 1 ? "s" : ""} registrado{clientes.length !== 1 ? "s" : ""} en la cartera
        </p>
      </div>

      {apiError && (
        <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs font-bold leading-normal">
          <span>⚠️ {apiError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Formulario de registro (Izquierda) */}
        <div className="lg:sticky lg:top-20">
          <Card variant="simple" className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-center justify-center">
                <UserPlus size={18} className="text-indigo-700" />
              </div>
              <div>
                <h2 className="font-black text-slate-800 text-sm leading-none">Registrar Cliente</h2>
                <p className="text-[9px] text-slate-500 font-bold uppercase mt-1">Nuevo prestatario</p>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-2" />

            {successMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl text-xs font-bold">
                {successMsg}
              </div>
            )}

            {errorMsg && !showEditModal && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs font-bold">
                {errorMsg}
              </div>
            )}

            <ClientForm
              onSubmit={handleCreateClient}
              isLoading={formLoading}
            />
          </Card>
        </div>

        {/* Listado de Clientes (Derecha) */}
        <div className="lg:col-span-2">
          <Card variant="simple" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-indigo-750 shrink-0" />
                <h2 className="font-black text-slate-800 text-base tracking-tight leading-none">Directorio de Deudores</h2>
              </div>
              <span className="text-[10px] font-black bg-slate-100 border border-slate-200 text-slate-600 px-2.5 py-1 rounded-lg">
                {clientes.length} Clientes
              </span>
            </div>

            <div className="border-t border-slate-100" />

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="animate-spin text-indigo-600 mb-3" size={32} />
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Cargando directorio de deudas...</p>
              </div>
            ) : (
              <ClientList
                clientes={clientes}
                onEditClient={handleOpenEditModal}
              />
            )}
          </Card>
        </div>
      </div>

      {/* Modal Editar Cliente */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Editar Datos de Prestatario"
        size="md"
      >
        {selectedCliente && (
          <div className="space-y-4">
            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs font-bold">
                {errorMsg}
              </div>
            )}

            <ClientForm
              initialData={selectedCliente}
              onSubmit={handleUpdateClientSubmit}
              isLoading={formLoading}
              onCancel={() => setShowEditModal(false)}
            />

            {/* Documentos del Cliente (Editar) */}
            <div className="border-t border-slate-100 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest flex items-center gap-1.5 select-none">
                  <FileText size={11} /> Documentos Cargados
                </span>
                
                <div className="flex items-center gap-2">
                  <select
                    value={selectedDocTipo}
                    onChange={e => setSelectedDocTipo(e.target.value as TipoDocumento)}
                    className="glass-input rounded-xl px-2 py-1.5 text-[9px] font-black cursor-pointer bg-white border-slate-200"
                  >
                    {(Object.entries(TIPOS_DOCUMENTO_CONFIG) as [TipoDocumento, { label: string; icon: string }][]).map(([k, v]) => (
                      <option key={k} value={k}>{v.icon} {v.label}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => editFileInputRef.current?.click()}
                    disabled={uploadingDoc}
                    className="px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition text-[10px] font-black flex items-center gap-1 cursor-pointer"
                  >
                    {uploadingDoc ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
                    <span>Subir</span>
                  </button>
                  <input
                    ref={editFileInputRef}
                    type="file"
                    className="hidden"
                    accept={ACCEPT_DOCUMENTOS}
                    onChange={handleEditUploadDoc}
                  />
                </div>
              </div>

              {loadingDocs ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 size={18} className="animate-spin text-indigo-700" />
                </div>
              ) : editDocs.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-[10px] font-bold uppercase tracking-wider bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                  Sin documentos cargados
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {editDocs.map(doc => (
                    <div key={doc.id} className="group relative border border-slate-200 bg-slate-50/50 rounded-xl overflow-hidden shadow-sm">
                      <div className="aspect-[4/3] bg-slate-100 flex items-center justify-center overflow-hidden select-none">
                        {doc.mime_type.startsWith("image/") ? (
                          <img src={doc.drive_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="flex flex-col items-center gap-1 text-slate-500 p-2 text-center">
                            <span className="text-2xl">{getMimeIcon(doc.mime_type)}</span>
                            <span className="text-[9px] truncate w-full font-mono">{doc.nombre_archivo}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="p-2">
                        <p className="text-[9px] font-black text-indigo-750 uppercase tracking-wide truncate">
                          {TIPOS_DOCUMENTO_CONFIG[doc.tipo_documento]?.icon} {TIPOS_DOCUMENTO_CONFIG[doc.tipo_documento]?.label}
                        </p>
                        <p className="text-[9px] text-slate-500 truncate mt-0.5">{doc.nombre_archivo}</p>
                      </div>

                      {/* Overlays */}
                      <div className="absolute inset-0 bg-slate-900/75 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                          onClick={() => setPreviewDoc(doc)}
                          className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition cursor-pointer border-none"
                          title="Visualizar"
                        >
                          <Eye size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteDoc(doc.id)}
                          className="p-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/40 text-rose-100 transition cursor-pointer border-none"
                          title="Eliminar"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Lightbox Preview */}
      {previewDoc && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/90"
          onClick={() => setPreviewDoc(null)}
        >
          <div
            className="relative max-w-3xl w-full mx-4 rounded-3xl overflow-hidden bg-white border border-slate-200 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {previewDoc.mime_type.startsWith("image/") ? (
              <img src={previewDoc.drive_url} alt={previewDoc.nombre_archivo} className="w-full max-h-[75vh] object-contain bg-slate-100" />
            ) : (
              <iframe src={previewDoc.drive_url} className="w-full h-[70vh] border-none" title={previewDoc.nombre_archivo} />
            )}
            
            <button
              onClick={() => setPreviewDoc(null)}
              className="absolute top-4 right-4 p-2 rounded-xl bg-slate-900/80 text-white hover:bg-slate-950 transition cursor-pointer border-none flex items-center justify-center"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
