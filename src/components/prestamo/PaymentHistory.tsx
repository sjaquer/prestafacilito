import React, { useState } from "react";
import { MessageSquare, Eye, FileText, Image, Calendar, Check, X } from "lucide-react";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { formatCurrency, formatDateShort, parseVoucherUrls } from "../../lib/formatters";
import { Amortizacion } from "../../types";

interface PaymentHistoryProps {
  pagos: Amortizacion[];
  prestamo: any;
  onVoucherClick: (pago: any) => void;
  onViewComprobante: (url: string) => void;
  resolveVoucherUrl: (url: string | null | undefined) => string;
  onUpdateFechaPago?: (pagoId: string, nuevaFecha: string) => Promise<boolean>;
}

export const PaymentHistory: React.FC<PaymentHistoryProps> = ({
  pagos,
  prestamo,
  onVoucherClick,
  onViewComprobante,
  resolveVoucherUrl,
  onUpdateFechaPago,
}) => {
  const [editingPagoId, setEditingPagoId] = useState<string | null>(null);
  const [editFecha, setEditFecha] = useState<string>("");
  const [saving, setSaving] = useState<boolean>(false);

  const startEdit = (pago: Amortizacion) => {
    setEditingPagoId(pago.id);
    setEditFecha(pago.fecha_pago ? pago.fecha_pago.split("T")[0] : "");
  };

  const handleSave = async (pagoId: string) => {
    if (!editFecha) return;
    if (!onUpdateFechaPago) return;

    const confirmSave = window.confirm(
      "⚠️ ¿Estás seguro de cambiar la fecha de pago? Esto recalculará los intereses y la mora del préstamo de forma permanente."
    );
    if (!confirmSave) return;

    setSaving(true);
    try {
      const success = await onUpdateFechaPago(pagoId, editFecha);
      if (success) {
        setEditingPagoId(null);
      }
    } catch (err) {
      console.error("Error al actualizar la fecha:", err);
    } finally {
      setSaving(false);
    }
  };

  const isAlquiler = prestamo.tipo_prestamo === "Alquiler de Casa";
  const getWhatsAppShare = (pago: any) => {
    const phone = prestamo.cliente_telefono?.replace(/\D/g, "").trim();
    if (!phone) return null;

    const folio = `REC-${pago.id.slice(0, 8).toUpperCase()}`;
    const formattedMonto = formatCurrency(pago.monto);
    const fecha = formatDateShort(pago.fecha_pago);

    const text = `¡Hola, ${prestamo.cliente_nombre}! Te saludamos de la administración. 🇵🇪 Confirmamos la recepción de tu pago de ${formattedMonto} registrado el ${fecha} vía ${pago.metodo_pago}. Tu folio de comprobante es: ${folio}. ¡Muchas gracias por tu compromiso!`;

    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  };

  return (
    <Card variant="simple" className="select-none font-sans flex flex-col h-full">
      <div className="p-1 border-b border-slate-100 pb-4">
        <h2 className="text-sm md:text-base font-black text-slate-850 tracking-tight leading-none">
          {isAlquiler ? "Historial de Pagos de Alquiler" : "Historial de Amortizaciones"}
        </h2>
        <p className="text-[10px] text-slate-550 font-bold uppercase tracking-wider mt-1.5">
          {isAlquiler ? "Lista cronológica de mensualidades canceladas para este alquiler" : "Lista cronológica de abonos recibidos para este crédito"}
        </p>
      </div>

      <div className="mt-5 flex-1 overflow-y-auto max-h-[360px] scrollbar-thin">
        {pagos.length === 0 ? (
          <div className="text-center py-12 text-slate-500 font-bold text-xs md:text-sm">
            {isAlquiler ? "Aún no se registran pagos en este alquiler." : "Aún no se registran abonos en este crédito."}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pagos.map((pago) => {
              const waShare = getWhatsAppShare(pago);
              const voucherUrls = parseVoucherUrls(pago.comprobante_url);
              const hasVoucher = voucherUrls.length > 0;
              const isEditing = editingPagoId === pago.id;

              return (
                <div 
                  key={pago.id}
                  className="bg-white border border-slate-200 rounded-3xl p-5 space-y-3.5 text-xs font-semibold shadow-sm hover:shadow-md transition-all duration-300 relative select-none hover:border-slate-350"
                >
                  {/* Left color bar */}
                  <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-emerald-500 rounded-l-3xl" />

                  <div className="pl-1.5 space-y-3">
                    <div className="flex justify-between items-center gap-2">
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="date"
                            value={editFecha}
                            onChange={(e) => setEditFecha(e.target.value)}
                            disabled={saving}
                            className="bg-white border border-slate-250 rounded px-1.5 py-0.5 text-[10px] font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                          <button
                            onClick={() => handleSave(pago.id)}
                            disabled={saving}
                            className="text-emerald-600 hover:text-emerald-800 p-1 hover:bg-emerald-50 rounded-lg transition border-none bg-transparent cursor-pointer flex items-center justify-center"
                          >
                            {saving ? (
                              <span className="w-3.5 h-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Check size={12} />
                            )}
                          </button>
                          <button
                            onClick={() => setEditingPagoId(null)}
                            disabled={saving}
                            className="text-rose-600 hover:text-rose-800 p-1 hover:bg-rose-50 rounded-lg transition border-none bg-transparent cursor-pointer flex items-center justify-center"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col">
                          <span className="text-[9px] text-slate-400 uppercase tracking-widest font-black">Fecha Pago</span>
                          <span className="text-slate-800 font-mono mt-0.5 font-bold">
                            {formatDateShort(pago.fecha_pago)}
                          </span>
                        </div>
                      )}

                      <div className="flex flex-col items-end">
                        <span className="text-[9px] text-slate-400 uppercase tracking-widest font-black">Monto Abonado</span>
                        <span className="text-emerald-700 font-mono font-black text-base mt-0.5">
                          {formatCurrency(pago.monto)}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-slate-550 pt-2 border-t border-slate-100/80">
                      <div className="flex flex-col">
                        <span className="text-[9px] text-slate-400 uppercase tracking-widest font-black">Método</span>
                        <span className="text-slate-800 uppercase font-bold mt-0.5">{pago.metodo_pago}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[9px] text-slate-400 uppercase tracking-widest font-black">Clasificación</span>
                        <span className="text-slate-655 font-bold mt-0.5">{pago.tipo_movimiento || "Pago Ordinario"}</span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-3 border-t border-slate-100 flex-wrap gap-2">
                      <div>
                        {hasVoucher ? (
                          <div className="flex flex-wrap gap-1.5">
                            {voucherUrls.map((url, index) => (
                              <button
                                key={index}
                                onClick={() => onViewComprobante(resolveVoucherUrl(url))}
                                className="text-emerald-655 hover:text-emerald-750 font-bold transition flex items-center gap-0.5 bg-transparent border-none cursor-pointer text-[10px]"
                                title={`Ver comprobante ${index + 1}`}
                              >
                                <Eye size={12} />
                                <span>Voucher {voucherUrls.length > 1 ? index + 1 : ""}</span>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 font-normal">Sin voucher</span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {onUpdateFechaPago && !isEditing && (
                          <button
                            onClick={() => startEdit(pago)}
                            className="text-indigo-650 hover:text-indigo-850 p-1.5 hover:bg-indigo-50 rounded-lg transition border-none bg-transparent cursor-pointer"
                            title="Editar fecha de abono"
                          >
                            <Calendar size={13} />
                          </button>
                        )}
                        <button
                          onClick={() => onVoucherClick(pago)}
                          className="text-slate-550 hover:text-slate-800 p-1.5 hover:bg-slate-50 rounded-lg transition border-none bg-transparent cursor-pointer"
                          title="Recibo Oficial"
                        >
                          <FileText size={13} />
                        </button>
                        {waShare && (
                          <a
                            href={waShare}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-600 hover:text-emerald-700 p-1.5 hover:bg-emerald-50 rounded-lg transition"
                            title="Compartir abono por WhatsApp"
                          >
                            <MessageSquare size={13} />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
};
export default PaymentHistory;
