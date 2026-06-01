import React, { useState, useEffect } from "react";
import { Coins, HelpCircle, Eye, Calendar } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Tooltip } from "../ui/Tooltip";
import { Cliente } from "../../types";
import { validateLoanAmount, validateInterestRate } from "../../lib/validators";
import { formatCurrency } from "../../lib/formatters";

interface NewLoanModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientes: Cliente[];
  onSubmit: (data: {
    cliente_id: string;
    monto_capital: number;
    tasa_interes_porcentaje: number;
    fecha_emision: string;
    fecha_vencimiento: string | null;
    tipo_prestamo: string;
  }) => Promise<boolean>;
}

export const NewLoanModal: React.FC<NewLoanModalProps> = ({
  isOpen,
  onClose,
  clientes,
  onSubmit,
}) => {
  const [clienteId, setClienteId] = useState("");
  const [monto, setMonto] = useState("");
  const [tasa, setTasa] = useState("");
  const [fechaEmision, setFechaEmision] = useState(() => new Date().toISOString().split("T")[0]);
  const [fechaVencimiento, setFechaVencimiento] = useState("");
  const [tipo, setTipo] = useState("Personal");
  const [busqueda, setBusqueda] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Estados para modo Alquiler de Casa y Otros
  const [montoMensual, setMontoMensual] = useState("");
  const [duracionMeses, setDuracionMeses] = useState("6");
  const [customTipo, setCustomTipo] = useState("");
  
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Filtrar clientes
  const filteredClientes = clientes.filter(c => 
    c.nombre_completo.toLowerCase().includes(busqueda.toLowerCase())
  );

  // Si cambia el tipo, establecer tasas por defecto
  useEffect(() => {
    if (tipo === "Personal" || tipo === "Negocio") {
      setTasa("10");
    } else if (tipo === "Alquiler de Casa") {
      setTasa("0");
    }
  }, [tipo]);

  // Auto-calcular fecha de vencimiento al cambiar fecha de emisión, tipo o duración
  useEffect(() => {
    if (tipo === "Alquiler de Casa") {
      if (fechaEmision) {
        const d = new Date(fechaEmision + "T12:00:00");
        d.setMonth(d.getMonth() + parseInt(duracionMeses || "6"));
        setFechaVencimiento(d.toISOString().split("T")[0]);
      }
    } else {
      if (fechaEmision) {
        const d = new Date(fechaEmision + "T12:00:00");
        d.setDate(d.getDate() + 30); // 30 días por defecto
        setFechaVencimiento(d.toISOString().split("T")[0]);
      }
    }
  }, [fechaEmision, tipo, duracionMeses]);

  // Auto-calcular el capital total en modo Alquiler de Casa (Mensualidad x Meses)
  useEffect(() => {
    if (tipo === "Alquiler de Casa") {
      const calcCapital = (parseFloat(montoMensual) || 0) * parseInt(duracionMeses || "6");
      setMonto(calcCapital > 0 ? calcCapital.toString() : "");
    }
  }, [montoMensual, duracionMeses, tipo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!clienteId) {
      setErrors(prev => ({ ...prev, cliente: "Debe seleccionar un cliente" }));
      return;
    }

    const nCapital = parseFloat(monto);
    const nTasa = parseFloat(tasa) || 0;

    const vAmount = validateLoanAmount(nCapital);
    if (!vAmount.valid) {
      setErrors(prev => ({ ...prev, monto: vAmount.error || "" }));
      return;
    }

    const vRate = validateInterestRate(nTasa);
    if (!vRate.valid) {
      setErrors(prev => ({ ...prev, tasa: vRate.error || "" }));
      return;
    }

    const finalTipo = tipo === "Otros" ? (customTipo.trim() || "Otros") : tipo;

    setSubmitting(true);
    const success = await onSubmit({
      cliente_id: clienteId,
      monto_capital: nCapital,
      tasa_interes_porcentaje: nTasa,
      fecha_emision: fechaEmision,
      fecha_vencimiento: fechaVencimiento || null,
      tipo_prestamo: finalTipo,
    });

    setSubmitting(false);
    if (success) {
      // Reset
      setClienteId("");
      setMonto("");
      setTasa("");
      setBusqueda("");
      setTipo("Personal");
      setMontoMensual("");
      setDuracionMeses("6");
      setCustomTipo("");
      onClose();
    }
  };

  // Cálculo rápido del total estimado para no-alquileres
  const totalEstimado = (() => {
    const cap = parseFloat(monto) || 0;
    const rate = parseFloat(tasa) || 0;
    
    if (cap <= 0 || !fechaEmision || !fechaVencimiento || tipo === "Alquiler de Casa") return 0;
    const start = new Date(fechaEmision);
    const end = new Date(fechaVencimiento);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
    
    let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    months = Math.max(1, months);
    
    return cap + (cap * (rate / 100) * months);
  })();

  const selectCliente = (c: Cliente) => {
    setClienteId(c.id);
    setBusqueda(c.nombre_completo);
    setShowDropdown(false);
    setErrors(prev => {
      const copy = { ...prev };
      delete copy.cliente;
      return copy;
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={tipo === "Alquiler de Casa" ? "Registrar Contrato de Alquiler" : "Otorgar Nuevo Crédito"}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 font-sans select-none">
        
        {/* Autocomplete Cliente */}
        <div className="relative space-y-1">
          <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider block">
            Cliente Prestatario <span className="text-rose-500 font-bold">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar cliente..."
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setClienteId("");
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              className={`glass-input w-full px-4 rounded-xl font-medium border ${
                errors.cliente ? "border-rose-500/50" : "border-white/8"
              }`}
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => {
                  setBusqueda("");
                  setClienteId("");
                  setShowDropdown(false);
                }}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>
          
          {showDropdown && filteredClientes.length > 0 && (
            <div className="absolute z-50 left-0 right-0 mt-1 bg-[#0d1020] border border-white/10 rounded-xl shadow-2xl max-h-48 overflow-y-auto font-medium">
              {filteredClientes.map((c) => (
                <div
                  key={c.id}
                  onClick={() => selectCliente(c)}
                  className="px-4 py-2.5 hover:bg-emerald-600 hover:text-white text-xs md:text-sm text-slate-350 transition cursor-pointer font-semibold"
                >
                  {c.nombre_completo}
                </div>
              ))}
            </div>
          )}

          {errors.cliente && (
            <span className="text-[10px] md:text-[11px] font-semibold text-rose-400">{errors.cliente}</span>
          )}
        </div>

        {/* Tipo de Préstamo / Deuda */}
        <div className="flex flex-col gap-1.5 w-full">
          <label className="text-[11px] md:text-[12px] font-black text-slate-400 uppercase tracking-wider block">
            Categoría del Crédito / Deuda
          </label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="glass-input w-full px-4 rounded-xl border border-white/8 font-medium bg-[#080c18] text-[#f8fafc] focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 cursor-pointer h-12"
          >
            <option value="Personal">Personal</option>
            <option value="Negocio">Comercio / Negocio</option>
            <option value="Alquiler de Casa">Alquiler de Casa (Contrato Mensual)</option>
            <option value="Hipotecario">Hipotecario</option>
            <option value="Garantía">Prendario / Con Garantía</option>
            <option value="Otros">Otros (Especificar Razón)</option>
          </select>
        </div>

        {/* Inputs Condicionales: Modo Alquiler de Casa */}
        {tipo === "Alquiler de Casa" && (
          <div className="space-y-4 p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl animate-fadeIn">
            <div className="flex items-center gap-3 border-b border-white/5 pb-3">
              <div className="w-12 h-12 bg-black/50 border border-white/5 rounded-xl overflow-hidden shrink-0">
                <img src="/housing_rental_icon.png" alt="Alquiler" className="w-full h-full object-cover" />
              </div>
              <div>
                <span className="text-[9.5px] font-black text-emerald-450 uppercase tracking-widest block">Configuración de Contrato de Alquiler</span>
                <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">Control de arrendamiento mensual</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider block pl-0.5">Monto Mensual (S/.) *</label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  placeholder="Ej. 1200"
                  value={montoMensual}
                  onChange={(e) => setMontoMensual(e.target.value)}
                  className="w-full glass-input rounded-xl px-4 font-medium border border-white/8 outline-none font-mono"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider block pl-0.5">Duración (Meses) *</label>
                <select
                  value={duracionMeses}
                  onChange={(e) => setDuracionMeses(e.target.value)}
                  className="w-full glass-input rounded-xl px-4 font-medium border border-white/8 outline-none bg-[#080c18] cursor-pointer h-12 text-slate-200"
                >
                  {[1,2,3,4,5,6,7,8,9,10,11,12,18,24].map(m => (
                    <option key={m} value={m} className="bg-[#0f172a]">{m} {m === 1 ? 'Mes' : 'Meses'}</option>
                  ))}
                </select>
              </div>
            </div>

            {parseFloat(montoMensual) > 0 && (
              <div className="bg-[#080c16] p-3.5 rounded-xl border border-white/5 text-[11px] text-slate-350 space-y-1.5 font-semibold leading-relaxed">
                <div className="flex justify-between">
                  <span>Período de contrato:</span>
                  <span className="text-white">{fechaEmision} al {fechaVencimiento}</span>
                </div>
                <div className="flex justify-between">
                  <span>Mensualidad:</span>
                  <span className="text-white font-mono">{formatCurrency(parseFloat(montoMensual))}</span>
                </div>
                <div className="flex justify-between border-t border-white/5 pt-1.5 mt-1 font-black text-xs md:text-sm text-white">
                  <span className="text-emerald-400">Capital Total (Deuda de Alquiler):</span>
                  <span className="font-financial">{formatCurrency(parseFloat(montoMensual) * parseInt(duracionMeses))}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Inputs Condicionales: Modo Otros (Especificar Razón) */}
        {tipo === "Otros" && (
          <div className="animate-fadeIn">
            <Input
              label="Especificar Razón / Tipo *"
              placeholder="Ej. Emergencia Médica, Compra de Mercadería"
              required
              value={customTipo}
              onChange={(e) => setCustomTipo(e.target.value)}
            />
          </div>
        )}

        {/* Grid de Monto e Interés Estándar (Sólo para NO Alquiler) */}
        {tipo !== "Alquiler de Casa" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label={tipo === "Otros" ? "Capital de Deuda (S/.)" : "Capital del Préstamo (S/.)"}
              placeholder="Ej: 5000"
              type="number"
              required
              value={monto}
              onChange={(e) => {
                setMonto(e.target.value);
                setErrors(prev => {
                  const c = { ...prev };
                  delete c.monto;
                  return c;
                });
              }}
              error={errors.monto}
            />

            <div className="relative">
              <Input
                label="Tasa de Interés Mensual (%)"
                placeholder="Ej: 10"
                type="number"
                required
                value={tasa}
                onChange={(e) => {
                  setTasa(e.target.value);
                  setErrors(prev => {
                    const c = { ...prev };
                    delete c.tasa;
                    return c;
                  });
                }}
                error={errors.tasa}
              />
              <div className="absolute right-0 top-0.5">
                <Tooltip content="Porcentaje de interés de préstamo cobrado de forma mensual.">
                  <HelpCircle size={13} className="text-slate-500 hover:text-emerald-400 cursor-pointer" />
                </Tooltip>
              </div>
            </div>
          </div>
        )}

        {/* Fechas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label={tipo === "Alquiler de Casa" ? "Fecha de Inicio de Contrato" : "Fecha de Desembolso"}
            type="date"
            required
            value={fechaEmision}
            onChange={(e) => setFechaEmision(e.target.value)}
          />
          <Input
            label={tipo === "Alquiler de Casa" ? "Fin del Contrato (Auto)" : "Fecha de Vencimiento Final"}
            type="date"
            required
            disabled={tipo === "Alquiler de Casa"}
            className={tipo === "Alquiler de Casa" ? "opacity-60" : ""}
            value={fechaVencimiento}
            onChange={(e) => setFechaVencimiento(e.target.value)}
          />
        </div>

        {/* Previsualización del total */}
        {tipo !== "Alquiler de Casa" && totalEstimado > 0 && (
          <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl flex items-center justify-between text-xs md:text-sm">
            <span className="font-bold text-slate-400 flex items-center gap-1.5">
              <Coins size={14} className="text-emerald-400" />
              Deuda Total Estimada:
            </span>
            <span className="font-financial text-emerald-300 text-sm md:text-base">
              {formatCurrency(totalEstimado)}
            </span>
          </div>
        )}

        {/* Submit */}
        <Button
          type="submit"
          variant="primary"
          loading={submitting}
          className="w-full mt-4 h-12 font-bold"
        >
          {tipo === "Alquiler de Casa" ? "Registrar Contrato de Alquiler" : "Otorgar Crédito y Generar Cuotas"}
        </Button>
      </form>
    </Modal>
  );
};
