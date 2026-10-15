import React from "react";
import { FileText, Image as ImageIcon, Eye, Loader2, Edit2, Trash2, Info, Paperclip } from "lucide-react";
import { formatCurrency, formatDateShort, parseVoucherUrls, resolveVoucherUrl } from "../../lib/formatters";

interface VoucherCardProps {
  pago: any;
  deleting: boolean;
  onPreview: (url: string) => void;
  onViewLoan: (pago: any) => void;
  onEdit: (pago: any) => void;
  onDelete: (pagoId: string) => void;
  onAttach: (pagoId: string) => void;
}

const iconBtn = "p-2 border rounded-xl transition cursor-pointer flex items-center justify-center";

/** Miniaturas de hasta 3 comprobantes; si la imagen no carga (PDF), muestra un acceso al archivo. */
const VoucherThumbs: React.FC<{ urls: string[]; onPreview: (url: string) => void }> = ({ urls, onPreview }) => (
  <div
    className="w-full h-full relative group p-1.5 grid gap-1.5"
    style={{ gridTemplateColumns: `repeat(${Math.min(urls.length, 3)}, 1fr)` }}
  >
    {urls.slice(0, 3).map((url, idx) => (
      <button
        key={idx}
        type="button"
        onClick={() => onPreview(resolveVoucherUrl(url))}
        className="relative rounded-xl overflow-hidden border border-slate-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        title="Ver voucher"
      >
        <img
          src={resolveVoucherUrl(url)}
          alt={`Voucher ${idx + 1}`}
          loading="lazy"
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = "none";
            e.currentTarget.nextElementSibling?.classList.remove("hidden");
          }}
        />
        <div className="hidden w-full h-full flex-col items-center justify-center text-slate-400 gap-1 p-2 bg-white">
          <FileText size={16} className="text-indigo-400" />
          <span className="text-[9px] font-bold text-center">Ver PDF</span>
        </div>
        {idx === 2 && urls.length > 3 && (
          <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center text-white font-black text-sm">
            +{urls.length - 3}
          </div>
        )}
      </button>
    ))}
  </div>
);

export const VoucherCard: React.FC<VoucherCardProps> = ({
  pago,
  deleting,
  onPreview,
  onViewLoan,
  onEdit,
  onDelete,
  onAttach,
}) => {
  const voucherUrls = parseVoucherUrls(pago.comprobante_url);
  const hasVoucher = voucherUrls.length > 0;
  const initials =
    pago.cliente_nombre
      ?.split(" ")
      .slice(0, 2)
      .map((n: string) => n[0])
      .join("")
      .toUpperCase() || "CL";

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-4.5 space-y-4 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center font-black text-sm text-indigo-700 select-none">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-extrabold text-slate-800 text-xs truncate leading-snug">{pago.cliente_nombre}</h4>
            <span className="text-[9px] text-slate-450 font-bold block">
              {formatDateShort(pago.fecha_pago)} · {pago.metodo_pago}
            </span>
          </div>
        </div>

        <div className="relative rounded-2xl border border-slate-100 overflow-hidden bg-slate-50 h-40 flex items-center justify-center">
          {hasVoucher ? (
            <VoucherThumbs urls={voucherUrls} onPreview={onPreview} />
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-400 gap-1">
              <ImageIcon size={28} className="opacity-40" />
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-450">Sin Archivo</span>
            </div>
          )}
        </div>

        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-2.5 space-y-1.5 mt-1 text-[11px] select-none">
          <div className="flex justify-between items-center text-[9px] text-slate-400 font-black uppercase tracking-wider">
            <span>Préstamo</span>
            <span className="text-indigo-700 font-extrabold">{pago.tipo_prestamo}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500 font-semibold">Capital:</span>
            <span className="text-slate-800 font-mono font-black">{formatCurrency(pago.monto_capital)}</span>
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-auto">
        <div className="flex flex-col">
          <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Monto Pago</span>
          <span className="text-emerald-700 font-mono font-black text-sm">{formatCurrency(pago.monto)}</span>
        </div>

        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => onViewLoan(pago)}
            className={`${iconBtn} bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100`}
            title="Ver préstamo y cronograma de pagos"
            aria-label="Ver préstamo y cronograma de pagos"
          >
            <Info size={12} />
          </button>
          <button
            type="button"
            onClick={() => onEdit(pago)}
            className={`${iconBtn} bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100`}
            title="Editar pago / reasignar préstamo"
            aria-label="Editar pago"
          >
            <Edit2 size={12} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(pago.id)}
            disabled={deleting}
            className={`${iconBtn} bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100 disabled:opacity-50`}
            title="Eliminar abono"
            aria-label="Eliminar abono"
          >
            {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
          </button>

          {hasVoucher ? (
            <a
              href={resolveVoucherUrl(voucherUrls[0])}
              target="_blank"
              rel="noopener noreferrer"
              className={`${iconBtn} bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100`}
              title="Abrir comprobante original en otra pestaña"
              aria-label="Abrir comprobante original"
            >
              <Eye size={12} />
            </a>
          ) : (
            <button
              type="button"
              onClick={() => onAttach(pago.id)}
              className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black transition flex items-center gap-1 border-none cursor-pointer shadow-sm"
            >
              <Paperclip size={11} />
              <span>Adjuntar Voucher</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
