import React, { useState } from "react";
import { Edit2, FileText, Loader2, Trash2 } from "lucide-react";
import { formatCurrency, formatDate, parseVoucherUrls, resolveVoucherUrl } from "../../lib/formatters";
import { usePagos } from "../../hooks/usePagos";
import { useFeedback } from "../ui/Feedback";
import { EditarPagoModal } from "../vouchers/EditarPagoModal";

interface PagosPrestamoListProps {
  pagos: any[];
  prestamo: any;
  clienteNombre: string;
  onVerVoucher: (url: string) => void;
  onChanged: () => void;
}

/** Abonos del préstamo, del más reciente al más antiguo, con edición y eliminación. */
export const PagosPrestamoList: React.FC<PagosPrestamoListProps> = ({
  pagos,
  prestamo,
  clienteNombre,
  onVerVoucher,
  onChanged,
}) => {
  const { notify, confirm } = useFeedback();
  const { deletePago } = usePagos();
  const [editing, setEditing] = useState<any | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const ordenados = [...pagos].sort((a, b) => String(b.fecha_pago).localeCompare(String(a.fecha_pago)));

  const handleDelete = async (pago: any) => {
    const ok = await confirm({
      title: "Eliminar abono",
      message: `¿Eliminar el abono de ${formatCurrency(pago.monto)} del ${formatDate(pago.fecha_pago)}?\n\nEl saldo, los intereses y la mora del préstamo se recalcularán.`,
      confirmLabel: "Eliminar",
      danger: true,
    });
    if (!ok) return;

    setDeletingId(pago.id);
    const res = await deletePago(pago.id);
    setDeletingId(null);
    if (res.success) {
      notify("Abono eliminado", "success");
      onChanged();
    } else {
      notify(res.error || "No se pudo eliminar el abono.");
    }
  };

  if (ordenados.length === 0) {
    return <p className="text-xs text-slate-500 text-center py-4">Todavía no hay abonos registrados.</p>;
  }

  return (
    <>
      <ul className="divide-y divide-slate-100">
        {ordenados.map((pago) => {
          const voucher = parseVoucherUrls(pago.comprobante_url)[0];
          return (
            <li key={pago.id} className="py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black font-mono text-slate-900">{formatCurrency(pago.monto)}</p>
                <p className="text-[11px] text-slate-500 font-semibold truncate">
                  {formatDate(pago.fecha_pago)} · {pago.metodo_pago || "—"}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {voucher && (
                  <button
                    type="button"
                    onClick={() => onVerVoucher(resolveVoucherUrl(voucher))}
                    className="p-2.5 rounded-xl text-indigo-600 hover:bg-indigo-50 transition"
                    title="Ver comprobante"
                    aria-label="Ver comprobante"
                  >
                    <FileText className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setEditing({ ...pago, cliente_id: prestamo.cliente_id, cliente_nombre: clienteNombre })}
                  className="p-2.5 rounded-xl text-slate-600 hover:bg-slate-100 transition"
                  title="Editar abono"
                  aria-label="Editar abono"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(pago)}
                  disabled={deletingId === pago.id}
                  className="p-2.5 rounded-xl text-rose-600 hover:bg-rose-50 transition disabled:opacity-50"
                  title="Eliminar abono"
                  aria-label="Eliminar abono"
                >
                  {deletingId === pago.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <EditarPagoModal
        pago={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          notify("Abono actualizado", "success");
          onChanged();
        }}
      />
    </>
  );
};
