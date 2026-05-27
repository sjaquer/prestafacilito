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
  
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Filtrar clientes
  const filteredClientes = clientes.filter(c => 
    c.nombre_completo.toLowerCase().includes(busqueda.toLowerCase())
  );

  // Auto-completar fecha de vencimiento si es necesario
  useEffect(() => {
    if (fechaEmision && !fechaVencimiento) {
      // Por defecto: 3 meses después
      const date = new Date(`${fechaEmision}T00:00:00`);
      date.setMonth(date.getMonth() + 3);
      setFechaVencimiento(date.toISOString().split("T")[0]);
    }
  }, [fechaEmision, fechaVencimiento]);

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

    setSubmitting(true);
    const success = await onSubmit({
      cliente_id: clienteId,
      monto_capital: nCapital,
      tasa_interes_porcentaje: nTasa,
      fecha_emision: fechaEmision,
      fecha_vencimiento: fechaVencimiento || null,
      tipo_prestamo: tipo,
    });

    setSubmitting(false);
    if (success) {
      // Reset
      setClienteId("");
      setMonto("");
      setTasa("");
      setBusqueda("");
      setTipo("Personal");
      onClose();
    }
  };

  // Cálculo rápido del total estimado
  const totalEstimado = (() => {
    const cap = parseFloat(monto) || 0;
    const rate = parseFloat(tasa) || 0;
    
    if (cap <= 0 || !fechaEmision || !fechaVencimiento) return 0;
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
      title="Otorgar Nuevo Crédito"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 font-sans select-none">
        
        {/* Autocomeplete Cliente */}
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
                  className="px-4 py-2.5 hover:bg-indigo-600 hover:text-white text-xs md:text-sm text-slate-300 transition cursor-pointer"
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

        {/* Grid de Monto e Interés */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Capital del Préstamo (S/.)"
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
              <Tooltip content="Porcentaje de interés fijo cobrado al cliente de forma mensual sobre el saldo restante.">
                <HelpCircle size={13} className="text-slate-500 hover:text-indigo-400 cursor-pointer" />
              </Tooltip>
            </div>
          </div>
        </div>

        {/* Tipo de Préstamo */}
        <div className="flex flex-col gap-1.5 w-full">
          <label className="text-[11px] md:text-[12px] font-black text-slate-400 uppercase tracking-wider block">
            Categoría del Crédito
          </label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="glass-input w-full px-4 rounded-xl border border-white/8 font-medium bg-[#080c18] text-[#f8fafc] focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 cursor-pointer h-12"
          >
            <option value="Personal">Personal</option>
            <option value="Negocio">Comercio / Negocio</option>
            <option value="Hipotecario">Hipotecario</option>
            <option value="Garantía">Prendario / Con Garantía</option>
            <option value="Otro">Otro</option>
          </select>
        </div>

        {/* Fechas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Fecha de Desembolso"
            type="date"
            required
            value={fechaEmision}
            onChange={(e) => setFechaEmision(e.target.value)}
          />
          <Input
            label="Fecha de Vencimiento Final"
            type="date"
            required
            value={fechaVencimiento}
            onChange={(e) => setFechaVencimiento(e.target.value)}
          />
        </div>

        {/* Previsualización del total */}
        {totalEstimado > 0 && (
          <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl flex items-center justify-between text-xs md:text-sm">
            <span className="font-bold text-slate-400 flex items-center gap-1.5">
              <Coins size={14} className="text-indigo-400" />
              Deuda Total Estimada:
            </span>
            <span className="font-black text-indigo-300 font-mono text-sm md:text-base">
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
          Otorgar Crédito y Generar Cuotas
        </Button>
      </form>
    </Modal>
  );
};
