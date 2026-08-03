import React, { useState, useEffect, useRef } from "react";
import { X, User, Phone, MapPin, CreditCard, FileText, ChevronDown, ChevronUp, Save, ShieldCheck, Upload, Trash2 } from "lucide-react";
import { Cliente, TipoDocumento, TIPOS_DOCUMENTO_CONFIG, ACCEPT_DOCUMENTOS } from "../../types";

interface ClientSlideOverFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (clientData: Partial<Cliente>, files: { tipo: TipoDocumento; file: File }[]) => Promise<boolean>;
  clienteToEdit?: Cliente | null;
}

export const ClientSlideOverForm: React.FC<ClientSlideOverFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  clienteToEdit = null
}) => {
  const [nombreCompleto, setNombreCompleto] = useState("");
  const [apodo, setApodo] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");

  const [bancoCuenta, setBancoCuenta] = useState("");
  const [numeroCuenta, setNumeroCuenta] = useState("");
  const [showBankDetails, setShowBankDetails] = useState(false);

  const [observaciones, setObservaciones] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Documentos a adjuntar al registrar el cliente
  const [pendingDocs, setPendingDocs] = useState<{ tipo: TipoDocumento; file: File; preview: string }[]>([]);
  const [selectedDocTipo, setSelectedDocTipo] = useState<TipoDocumento>("dni_frontal");
  const docInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (clienteToEdit) {
      setNombreCompleto(clienteToEdit.nombre_completo || "");
      setApodo(clienteToEdit.apodo || "");
      setTelefono(clienteToEdit.telefono || "");
      setDireccion(clienteToEdit.direccion || "");
      setBancoCuenta(clienteToEdit.banco_cuenta || "");
      setNumeroCuenta(clienteToEdit.numero_cuenta || "");
      setObservaciones(clienteToEdit.observaciones || "");
      if (clienteToEdit.banco_cuenta || clienteToEdit.numero_cuenta) {
        setShowBankDetails(true);
      }
    } else {
      setNombreCompleto("");
      setApodo("");
      setTelefono("");
      setDireccion("");
      setBancoCuenta("");
      setNumeroCuenta("");
      setObservaciones("");
      setShowBankDetails(false);
    }
    setPendingDocs([]);
    setErrorMsg("");
  }, [clienteToEdit, isOpen]);

  if (!isOpen) return null;

  const handleAddPendingDoc = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const nuevos: { tipo: TipoDocumento; file: File; preview: string }[] = [];
    for (const file of Array.from(files)) {
      const preview = file.type.startsWith("image/") ? URL.createObjectURL(file) : "";
      nuevos.push({ tipo: selectedDocTipo, file, preview });
    }
    setPendingDocs((prev) => [...prev, ...nuevos]);
    e.target.value = "";
  };

  const removePendingDoc = (index: number) => {
    setPendingDocs((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombreCompleto.trim()) {
      setErrorMsg("El nombre completo es obligatorio.");
      return;
    }
    if (!telefono.trim()) {
      setErrorMsg("El teléfono es obligatorio.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");

    try {
      const success = await onSubmit({
        nombre_completo: nombreCompleto.trim(),
        apodo: apodo.trim(),
        telefono: telefono.trim(),
        direccion: direccion.trim(),
        banco_cuenta: bancoCuenta.trim(),
        numero_cuenta: numeroCuenta.trim(),
        observaciones: observaciones.trim()
      }, pendingDocs.map((d) => ({ tipo: d.tipo, file: d.file })));

      if (success) {
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "No se pudo guardar el cliente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end transition-opacity">
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col justify-between border-l border-slate-200 animate-slideLeft">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">
                {clienteToEdit ? "Editar Cliente" : "Nuevo Cliente"}
              </h2>
              <p className="text-xs text-slate-300">
                {clienteToEdit ? "Modificar expediente" : "Registrar nuevo prestatario o inquilino"}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 font-medium">
              {errorMsg}
            </div>
          )}

          {/* Grupo 1: Datos Principales */}
          <div className="space-y-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Grupo 1 — Datos Principales
            </span>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Nombre Completo *
              </label>
              <input
                type="text"
                placeholder="Ej: Juan Pérez Morales"
                value={nombreCompleto}
                onChange={(e) => setNombreCompleto(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-emerald-500 focus:bg-white transition-all font-medium"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Apodo / Alias (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej: Juancho"
                  value={apodo}
                  onChange={(e) => setApodo(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-emerald-500 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Teléfono *
                </label>
                <input
                  type="text"
                  placeholder="Ej: 987654321"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-emerald-500 focus:bg-white transition-all font-medium"
                  required
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Dirección / Domicilio (opcional)
              </label>
              <input
                type="text"
                placeholder="Ej: Av. Los Pinos 123"
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-emerald-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          {/* Grupo 2: Datos Bancarios (Colapsable) */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowBankDetails(!showBankDetails)}
              className="w-full p-3 bg-slate-50 flex items-center justify-between text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-slate-500" /> Grupo 2 — Datos Bancarios (opcional)
              </span>
              {showBankDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showBankDetails && (
              <div className="p-3 space-y-3 bg-white border-t border-slate-200">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Banco / Entidad</label>
                  <select
                    value={bancoCuenta}
                    onChange={(e) => setBancoCuenta(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-emerald-500 focus:bg-white transition-all"
                  >
                    <option value="">-- Seleccionar Banco --</option>
                    <option value="BCP">BCP</option>
                    <option value="Interbank">Interbank</option>
                    <option value="BBVA">BBVA</option>
                    <option value="Scotiabank">Scotiabank</option>
                    <option value="Yape">Yape</option>
                    <option value="Plin">Plin</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Número de Cuenta / Celular</label>
                  <input
                    type="text"
                    placeholder="Ej: 193-1234567-0-12 ó 987654321"
                    value={numeroCuenta}
                    onChange={(e) => setNumeroCuenta(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-emerald-500 focus:bg-white transition-all"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Grupo 3: Observaciones */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Grupo 3 — Notas y Observaciones
            </span>
            <textarea
              rows={3}
              placeholder="Información adicional relevante del cliente..."
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-emerald-500 focus:bg-white transition-all resize-none"
            />
          </div>

          {/* Grupo 4: Documentos / Comprobantes (DNI, recibos, PDF) */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="p-3 bg-slate-50 flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-500" /> Grupo 4 — Documentos (opcional)
              </span>
            </div>
            <div className="p-3 space-y-3 border-t border-slate-200">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Tipo de Documento</label>
                <select
                  value={selectedDocTipo}
                  onChange={(e) => setSelectedDocTipo(e.target.value as TipoDocumento)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-emerald-500 focus:bg-white"
                >
                  {(Object.entries(TIPOS_DOCUMENTO_CONFIG) as [TipoDocumento, { label: string; icon: string }][]).map(([k, v]) => (
                    <option key={k} value={k}>{v.icon} {v.label}</option>
                  ))}
                </select>
              </div>

              <input
                ref={docInputRef}
                type="file"
                accept={ACCEPT_DOCUMENTOS}
                multiple
                onChange={handleAddPendingDoc}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => docInputRef.current?.click()}
                className="w-full px-3 py-2.5 bg-slate-50 border border-dashed border-slate-300 hover:border-emerald-400 rounded-xl text-xs text-slate-600 flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Upload className="w-4 h-4 text-slate-400" />
                <span>Subir uno o varios archivos (imágenes o PDF)</span>
              </button>

              {pendingDocs.length > 0 && (
                <ul className="space-y-2">
                  {pendingDocs.map((doc, index) => (
                    <li
                      key={`${doc.tipo}-${index}`}
                      className="flex items-center justify-between px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        {doc.preview ? (
                          <img
                            src={doc.preview}
                            alt={doc.file.name}
                            className="w-8 h-8 object-cover rounded-md shrink-0"
                          />
                        ) : (
                          <FileText className="w-5 h-5 text-slate-500 shrink-0" />
                        )}
                        <span className="flex flex-col leading-tight min-w-0">
                          <span className="truncate font-medium text-slate-800">
                            {TIPOS_DOCUMENTO_CONFIG[doc.tipo].label}
                          </span>
                          <span className="truncate text-[10px] text-slate-400">
                            {doc.file.name} ({(doc.file.size / 1024).toFixed(1)} KB)
                          </span>
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removePendingDoc(index)}
                        className="p-0.5 hover:bg-slate-200 rounded text-slate-400 hover:text-red-600 transition shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-100 transition-colors text-xs"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5 text-xs disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSubmitting ? "Guardando..." : "Guardar Cliente"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
