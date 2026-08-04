export interface MetodoPagoOption {
  id: string;
  nombre: string;
  tipo: "efectivo" | "banco" | "billetera";
  colorBadge: string;
}

export const METODOS_PAGO_OPCIONES: MetodoPagoOption[] = [
  { id: "Efectivo", nombre: "Efectivo", tipo: "efectivo", colorBadge: "bg-emerald-100 text-emerald-800" },
  { id: "Yape", nombre: "Yape", tipo: "billetera", colorBadge: "bg-purple-100 text-purple-800" },
  { id: "Plin", nombre: "Plin", tipo: "billetera", colorBadge: "bg-cyan-100 text-cyan-800" },
  { id: "BCP", nombre: "BCP (Banco de Crédito)", tipo: "banco", colorBadge: "bg-blue-100 text-blue-800" },
  { id: "Interbank", nombre: "Interbank", tipo: "banco", colorBadge: "bg-emerald-100 text-emerald-800" },
  { id: "BBVA", nombre: "BBVA Continental", tipo: "banco", colorBadge: "bg-indigo-100 text-indigo-800" },
  { id: "Scotiabank", nombre: "Scotiabank", tipo: "banco", colorBadge: "bg-red-100 text-red-800" },
  { id: "Banco de la Nación", nombre: "Banco de la Nación", tipo: "banco", colorBadge: "bg-rose-100 text-rose-800" },
  { id: "Transferencia Bancaria", nombre: "Transferencia Bancaria", tipo: "banco", colorBadge: "bg-slate-100 text-slate-800" },
  { id: "Otro", nombre: "Otro Método", tipo: "efectivo", colorBadge: "bg-gray-100 text-gray-800" },
];
