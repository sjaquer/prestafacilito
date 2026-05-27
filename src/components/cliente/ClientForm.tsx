import React, { useState, useRef } from "react";
import {
  UserPlus, Phone, Loader2, MapPin, CreditCard,
  X, Upload, AlertCircle, Info, Edit3
} from "lucide-react";
import { Cliente, TipoDocumento, TIPOS_DOCUMENTO_CONFIG, ACCEPT_DOCUMENTOS } from "../../types";
import { validatePhone } from "../../lib/validators";

interface ClientFormProps {
  initialData?: Cliente | null;
  onSubmit: (data: any, files: { tipo: TipoDocumento; file: File }[]) => Promise<void>;
  isLoading: boolean;
  onCancel?: () => void;
}

export const ClientForm: React.FC<ClientFormProps> = ({
  initialData,
  onSubmit,
  isLoading,
  onCancel
}) => {
  const isEdit = !!initialData;
  const [nombre, setNombre] = useState(initialData?.nombre_completo || "");
  
  // Strip 51 country code from phone for input editing
  const getRawPhone = (phoneNum?: string) => {
    if (!phoneNum) return "";
    const clean = phoneNum.replace(/\D/g, "");
    if (clean.startsWith("51") && clean.length === 11) {
      return clean.slice(2);
    }
    return phoneNum.startsWith("'") ? phoneNum.substring(1) : phoneNum;
  };
  
  const [telefono, setTelefono] = useState(getRawPhone(initialData?.telefono));
  const [direccion, setDireccion] = useState(initialData?.direccion || "");
  const [numeroCuenta, setNumeroCuenta] = useState(initialData?.numero_cuenta || "");
  const [bancoCuenta, setBancoCuenta] = useState(initialData?.banco_cuenta || "");
  const [infoAdicional, setInfoAdicional] = useState(initialData?.informacion_adicional || "");
  const [observaciones, setObservaciones] = useState(initialData?.observaciones || "");

  // Document management (for creation only, since edit mode uploads immediately)
  const [pendingDocs, setPendingDocs] = useState<{ tipo: TipoDocumento; file: File; preview: string }[]>([]);
  const [selectedDocTipo, setSelectedDocTipo] = useState<TipoDocumento>('dni_frontal');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Local validation errors
  const [phoneError, setPhoneError] = useState("");

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    setTelefono(raw);
    if (raw && !validatePhone(raw)) {
      setPhoneError("El teléfono celular de Perú debe tener 9 dígitos (empieza con 9)");
    } else {
      setPhoneError("");
    }
  };

  const handleAddPendingDoc = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : '';
    setPendingDocs(prev => [...prev, { tipo: selectedDocTipo, file, preview }]);
    e.target.value = '';
  };

  const removePendingDoc = (index: number) => {
    setPendingDocs(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;
    if (telefono && !validatePhone(telefono)) {
      setPhoneError("El teléfono debe tener 9 dígitos y empezar con 9");
      return;
    }

    const payload = {
      nombre_completo: nombre.trim(),
      telefono: telefono ? `51${telefono}` : "", // prefix Peru code
      direccion: direccion.trim(),
      numero_cuenta: numeroCuenta.trim(),
      banco_cuenta: bancoCuenta.trim(),
      informacion_adicional: infoAdicional.trim(),
      observaciones: observaciones.trim()
    };

    const filesToUpload = pendingDocs.map(d => ({ tipo: d.tipo, file: d.file }));
    
    await onSubmit(payload, filesToUpload);
    
    // Clear pending files if successful creation
    if (!isEdit) {
      setNombre("");
      setTelefono("");
      setDireccion("");
      setNumeroCuenta("");
      setBancoCuenta("");
      setInfoAdicional("");
      setObservaciones("");
      setPendingDocs([]);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Nombre */}
      <div className="space-y-1">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
          Nombre Completo *
        </label>
        <input
          type="text"
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          placeholder="Ej. Juan Pérez Gómez"
          className="w-full glass-input rounded-2xl px-4 py-3 text-sm font-semibold border-white/6 focus:border-indigo-500/80"
          required
          autoComplete="off"
          disabled={isLoading}
        />
      </div>

      {/* WhatsApp/Teléfono */}
      <div className="space-y-1">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
          Número Celular
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-400 text-xs font-black select-none">+51</span>
          <input
            type="text"
            value={telefono}
            onChange={handlePhoneChange}
            placeholder="987654321"
            maxLength={9}
            className={`w-full glass-input rounded-2xl pl-12 pr-4 py-3 text-sm font-mono font-bold border-white/6 ${
              phoneError ? "border-rose-500/50 focus:border-rose-500" : "focus:border-indigo-500/80"
            }`}
            autoComplete="off"
            disabled={isLoading}
          />
        </div>
        {phoneError ? (
          <p className="text-[10px] text-rose-455 font-semibold mt-1 flex items-center gap-1">
            <AlertCircle size={10} /> {phoneError}
          </p>
        ) : (
          <p className="text-[10px] text-slate-550 mt-1 font-semibold">9 dígitos celulares (el +51 se añade automáticamente)</p>
        )}
      </div>

      {/* Dirección */}
      <div className="space-y-1">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block flex items-center gap-1.5">
          <MapPin size={10} /> Dirección <span className="text-slate-600 normal-case font-medium">(opcional)</span>
        </label>
        <input
          type="text"
          value={direccion}
          onChange={e => setDireccion(e.target.value)}
          placeholder="Av. Principal 123, Lima"
          className="w-full glass-input rounded-2xl px-4 py-3 text-sm font-semibold border-white/6 focus:border-indigo-500/80"
          autoComplete="off"
          disabled={isLoading}
        />
      </div>

      {/* Datos bancarios */}
      <div className="space-y-1">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block flex items-center gap-1.5">
          <CreditCard size={10} /> Cuenta Bancaria <span className="text-slate-600 normal-case font-medium">(opcional)</span>
        </label>
        <input
          type="text"
          value={numeroCuenta}
          onChange={e => setNumeroCuenta(e.target.value)}
          placeholder="BCP 191-123456789-0-23 / Yape 987654321"
          className="w-full glass-input rounded-2xl px-4 py-3 text-xs font-mono font-bold border-white/6 focus:border-indigo-500/80"
          autoComplete="off"
          disabled={isLoading}
        />
      </div>

      {/* Grid de Info Adicional y Observaciones */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Info Adicional</label>
          <input
            type="text"
            value={infoAdicional}
            onChange={e => setInfoAdicional(e.target.value)}
            placeholder="Trabajo, referencias..."
            className="w-full glass-input rounded-2xl px-4 py-3 text-xs font-semibold border-white/6 focus:border-indigo-500/80"
            disabled={isLoading}
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Observaciones</label>
          <input
            type="text"
            value={observaciones}
            onChange={e => setObservaciones(e.target.value)}
            placeholder="Comentarios adicionales"
            className="w-full glass-input rounded-2xl px-4 py-3 text-xs font-semibold border-white/6 focus:border-indigo-500/80"
            disabled={isLoading}
          />
        </div>
      </div>

      {/* Creation documents (Not shown in edit form, as editing documents is dynamic and immediate) */}
      {!isEdit && (
        <div className="space-y-2 pt-2 border-t border-white/[0.04]">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-white/[0.05]" />
            <span className="text-[9px] font-black text-slate-550 uppercase tracking-widest">Documentos Soporte</span>
            <div className="flex-1 h-px bg-white/[0.05]" />
          </div>

          <div className="flex gap-2 items-center">
            <select
              value={selectedDocTipo}
              onChange={e => setSelectedDocTipo(e.target.value as TipoDocumento)}
              className="flex-1 glass-input rounded-xl px-3 py-2 text-[10px] font-black cursor-pointer bg-[#0b0e1b] border-white/6"
              disabled={isLoading}
            >
              {(Object.entries(TIPOS_DOCUMENTO_CONFIG) as [TipoDocumento, { label: string; icon: string }][]).map(([k, v]) => (
                <option key={k} value={k}>{v.icon} {v.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="px-3.5 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 transition text-[11px] font-black flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Upload size={12} /> Cargar
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept={ACCEPT_DOCUMENTOS}
              onChange={handleAddPendingDoc}
              disabled={isLoading}
            />
          </div>

          {pendingDocs.length > 0 ? (
            <div className="space-y-1.5 max-h-44 overflow-y-auto">
              {pendingDocs.map((pd, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 bg-white/[0.02] border border-white/[0.05] rounded-xl">
                  {pd.preview ? (
                    <img src={pd.preview} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center text-sm shrink-0">
                      {TIPOS_DOCUMENTO_CONFIG[pd.tipo].icon}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-white truncate leading-none">{pd.file.name}</p>
                    <p className="text-[9px] text-indigo-400 font-bold mt-1 uppercase tracking-wider">{TIPOS_DOCUMENTO_CONFIG[pd.tipo].label}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removePendingDoc(idx)}
                    className="p-1.5 rounded-lg hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 transition cursor-pointer border-none"
                    disabled={isLoading}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-slate-550 text-center py-1 font-semibold">
              (Opcional) DNI frontal, dni reverso, recibos, etc.
            </p>
          )}
        </div>
      )}

      {/* Botones de acción */}
      <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/[0.04]">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2.5 rounded-xl text-xs font-black text-slate-400 hover:text-white hover:bg-white/[0.04] transition border-none cursor-pointer"
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          disabled={isLoading}
          className="btn-primary py-2.5 px-5 rounded-xl text-xs font-black flex items-center gap-2 cursor-pointer border-none"
        >
          {isLoading ? (
            <>
              <Loader2 className="animate-spin shrink-0" size={13} />
              <span>{isEdit ? "Guardando..." : "Registrando..."}</span>
            </>
          ) : (
            <>
              {isEdit ? <Edit3 size={13} /> : <UserPlus size={13} />}
              <span>{isEdit ? "Guardar Cambios" : "Registrar Cliente"}</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
};
