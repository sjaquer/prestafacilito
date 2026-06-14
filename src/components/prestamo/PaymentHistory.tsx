import React from "react";
import { MessageSquare, Eye, FileText, Image } from "lucide-react";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { formatCurrency, formatDateShort } from "../../lib/formatters";
import { Amortizacion } from "../../types";

interface PaymentHistoryProps {
  pagos: Amortizacion[];
  prestamo: any;
  onVoucherClick: (pago: any) => void;
  onViewComprobante: (url: string) => void;
  resolveVoucherUrl: (url: string | null | undefined) => string;
}

export const PaymentHistory: React.FC<PaymentHistoryProps> = ({
  pagos,
  prestamo,
  onVoucherClick,
  onViewComprobante,
  resolveVoucherUrl,
}) => {
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
          <>
            {/* DESKTOP TABLE */}
            <div className="hidden md:block table-scroll-x">
              <table className="w-full text-left border-collapse data-table font-sans">
                <thead>
                  <tr className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100 select-none">
                    <th className="px-4 py-3">Fecha Pago</th>
                    <th className="px-4 py-3">Método</th>
                    <th className="px-4 py-3">Clasificación</th>
                    <th className="px-4 py-3">Monto Abonado</th>
                    <th className="px-4 py-3">Voucher</th>
                    <th className="px-4 py-3 text-right">Compartir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 text-xs font-semibold">
                  {pagos.map((pago) => {
                    const waShare = getWhatsAppShare(pago);
                    const hasVoucher = !!pago.comprobante_url;
                    
                    return (
                      <tr key={pago.id} className="hover:bg-slate-50/50 transition duration-150">
                        <td className="px-4 py-3 font-mono">
                          {formatDateShort(pago.fecha_pago)}
                        </td>
                        <td className="px-4 py-3 uppercase">
                          {pago.metodo_pago}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {pago.tipo_movimiento || "Pago Ordinario"}
                        </td>
                        <td className="px-4 py-3 text-emerald-700 font-mono font-extrabold text-sm">
                          {formatCurrency(pago.monto)}
                        </td>
                        
                        {/* Comprobante */}
                        <td className="px-4 py-3">
                          {hasVoucher ? (
                            <button
                              onClick={() => onViewComprobante(resolveVoucherUrl(pago.comprobante_url))}
                              className="text-emerald-655 hover:text-emerald-750 transition flex items-center gap-1 cursor-pointer bg-transparent border-none font-bold"
                            >
                              <Eye size={13} />
                              <span>Ver</span>
                            </button>
                          ) : (
                            <span className="text-slate-400">Ninguno</span>
                          )}
                        </td>

                        {/* Compartir recibo */}
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => onVoucherClick(pago)}
                              className="text-slate-500 hover:text-slate-800 p-1 hover:bg-slate-50 rounded-lg transition border-none bg-transparent cursor-pointer"
                              title="Ver e Imprimir Recibo Oficial"
                            >
                              <FileText size={13} />
                            </button>
                            {waShare && (
                              <a
                                href={waShare}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-emerald-600 hover:text-emerald-700 p-1 hover:bg-emerald-50 rounded-lg transition"
                                title="Compartir abono por WhatsApp"
                              >
                                <MessageSquare size={13} />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* MOBILE LIST */}
            <div className="md:hidden space-y-3">
              {pagos.map((pago) => {
                const waShare = getWhatsAppShare(pago);
                const hasVoucher = !!pago.comprobante_url;

                return (
                  <div key={pago.id} className="bg-slate-50/50 border border-slate-200 rounded-2xl p-4 space-y-2 text-xs font-semibold">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-slate-550 font-mono">
                        {formatDateShort(pago.fecha_pago)}
                      </span>
                      <span className="text-emerald-700 font-mono font-extrabold text-sm">
                        {formatCurrency(pago.monto)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-slate-550">
                      <span>Método: <strong className="text-slate-800 uppercase">{pago.metodo_pago}</strong></span>
                      <span>{pago.tipo_movimiento || "Pago Ordinario"}</span>
                    </div>

                    <div className="flex justify-between items-center pt-2.5 border-t border-slate-100">
                      <div>
                        {hasVoucher ? (
                          <button
                            onClick={() => onViewComprobante(resolveVoucherUrl(pago.comprobante_url))}
                            className="text-emerald-655 hover:text-emerald-750 font-bold transition flex items-center gap-1 bg-transparent border-none cursor-pointer"
                          >
                            <Eye size={12} />
                            <span>Ver Voucher</span>
                          </button>
                        ) : (
                          <span className="text-slate-400">Sin voucher</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onVoucherClick(pago)}
                          className="text-slate-500 hover:text-slate-800 p-1 hover:bg-slate-50 rounded-lg transition border-none bg-transparent cursor-pointer flex items-center gap-1 font-bold"
                        >
                          <FileText size={12} />
                          <span>Recibo</span>
                        </button>
                        {waShare && (
                          <a
                            href={waShare}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-600 hover:text-emerald-700 p-1 hover:bg-emerald-50 rounded-lg transition"
                          >
                            <MessageSquare size={12} />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

    </Card>
  );
};
export default PaymentHistory;
