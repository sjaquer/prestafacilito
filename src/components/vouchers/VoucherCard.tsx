import React, { useState } from "react";
import { CalendarDays, Edit2, ExternalLink, FileText, Loader2, Paperclip, Trash2 } from "lucide-react";
import { formatFechaCorta, formatSoles, parseVoucherUrls, resolveVoucherUrl } from "../../lib/formatters";
import { MenuAcciones } from "../ui/MenuAcciones";

interface VoucherCardProps {
  pago: any;
  deleting: boolean;
  onPreview: (url: string) => void;
  onViewLoan: (pago: any) => void;
  onEdit: (pago: any) => void;
  onDelete: (pagoId: string) => void;
  onAttach: (pagoId: string) => void;
}

/** Miniatura del primer comprobante (con contador si hay varios). Si no es imagen (PDF), muestra un ícono. */
const Miniatura: React.FC<{ urls: string[]; todos: string; onPreview: (url: string) => void }> = ({ urls, todos, onPreview }) => {
  const [noEsImagen, setNoEsImagen] = useState(false);
  const url = resolveVoucherUrl(urls[0]);
  return (
    <button
      type="button"
      onClick={() => onPreview(todos)}
      className="relative h-16 w-16 shrink-0 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center focus-visible:ring-2 focus-visible:ring-emerald-500"
      aria-label={urls.length > 1 ? `Ver los ${urls.length} comprobantes` : "Ver comprobante"}
    >
      {noEsImagen ? (
        <FileText className="w-6 h-6 text-indigo-400" />
      ) : (
        <img src={url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" onError={() => setNoEsImagen(true)} />
      )}
      {urls.length > 1 && (
        <span className="absolute bottom-1 right-1 px-1.5 rounded-md bg-slate-900/75 text-white text-[10px] font-black">+{urls.length - 1}</span>
      )}
    </button>
  );
};

/** Un pago en la lista de vouchers: comprobante, cliente, monto y acciones. */
export const VoucherCard: React.FC<VoucherCardProps> = ({ pago, deleting, onPreview, onViewLoan, onEdit, onDelete, onAttach }) => {
  const urls = parseVoucherUrls(pago.comprobante_url);
  const tiene = urls.length > 0;

  return (
    <li className={`bg-white border rounded-2xl p-3 flex items-center gap-3 ${tiene ? "border-slate-200/80" : "border-amber-200"}`}>
      {tiene ? (
        <Miniatura urls={urls} todos={pago.comprobante_url} onPreview={onPreview} />
      ) : (
        <button
          type="button"
          onClick={() => onAttach(pago.id)}
          className="h-16 w-16 shrink-0 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 text-amber-700 flex flex-col items-center justify-center gap-0.5"
          aria-label={`Adjuntar comprobante al pago de ${pago.cliente_nombre}`}
        >
          <Paperclip className="w-5 h-5" />
          <span className="text-[9px] font-black uppercase">Adjuntar</span>
        </button>
      )}

      <button type="button" onClick={() => onViewLoan(pago)} className="flex-1 min-w-0 text-left">
        <p className="flex items-baseline justify-between gap-2">
          <span className="font-extrabold text-slate-900 text-[15px] leading-tight truncate">{pago.cliente_nombre}</span>
          <span className="font-mono font-black text-emerald-700 text-[15px] shrink-0">{formatSoles(pago.monto)}</span>
        </p>
        <p className="text-[11px] text-slate-500 font-semibold truncate flex items-center gap-1 mt-0.5">
          <CalendarDays className="w-3 h-3 shrink-0" />
          {formatFechaCorta(pago.fecha_pago)} · {pago.metodo_pago || "Sin cuenta"}
        </p>
        <p className="text-[11px] text-slate-400 font-semibold truncate">
          {pago.tipo_prestamo} · prestó {formatSoles(pago.monto_capital)}
          {!tiene && <span className="text-amber-700"> · sin comprobante</span>}
        </p>
      </button>

      {deleting ? (
        <Loader2 className="w-5 h-5 text-slate-400 animate-spin mx-2.5" aria-label="Eliminando" />
      ) : (
        <MenuAcciones
          titulo={`Pago de ${pago.cliente_nombre} · ${formatSoles(pago.monto)}`}
          acciones={[
            { label: "Ver préstamo y cronograma", icon: <CalendarDays className="w-5 h-5" />, onClick: () => onViewLoan(pago) },
            ...(tiene ? [{ label: "Abrir comprobante original", icon: <ExternalLink className="w-5 h-5" />, href: resolveVoucherUrl(urls[0]) }] : []),
            { label: tiene ? "Adjuntar otro comprobante" : "Adjuntar comprobante", icon: <Paperclip className="w-5 h-5" />, onClick: () => onAttach(pago.id) },
            { label: "Editar pago", icon: <Edit2 className="w-5 h-5" />, onClick: () => onEdit(pago) },
            { label: "Eliminar pago", icon: <Trash2 className="w-5 h-5" />, onClick: () => onDelete(pago.id), peligro: true },
          ]}
        />
      )}
    </li>
  );
};
