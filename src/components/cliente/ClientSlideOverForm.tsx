import React, { useState, useEffect } from "react";
import { X, User, Phone, MapPin, CreditCard, FileText, ChevronDown, ChevronUp, Save, ShieldCheck } from "lucide-react";
import { Cliente } from "../../types";

interface ClientSlideOverFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (clientData: Partial<Cliente>) => Promise<boolean>;
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
    setErrorMsg("");
  }, [clienteToEdit, isOpen]);

  if (!isOpen) return null;

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
      });

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
