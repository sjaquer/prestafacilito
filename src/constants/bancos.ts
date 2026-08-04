export interface MetodoPagoOption {
  id: string;
  nombre: string;
  tipo: "efectivo" | "banco" | "billetera";
  colorBadge: string;
}

export const METODOS_PAGO_OPCIONES: MetodoPagoOption[] = [
  { id: "BCP / Yape (Sebastián)", nombre: "BCP / Yape (Sebastián)", tipo: "banco", colorBadge: "bg-blue-100 text-blue-800 border-blue-200" },
  { id: "BCP / Yape (Roberto)", nombre: "BCP / Yape (Roberto)", tipo: "banco", colorBadge: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  { id: "Interbank / Plin (Sebastián)", nombre: "Interbank / Plin (Sebastián)", tipo: "banco", colorBadge: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { id: "Interbank / Plin (Roberto)", nombre: "Interbank / Plin (Roberto)", tipo: "banco", colorBadge: "bg-teal-100 text-teal-800 border-teal-200" },
  { id: "BBVA (Roberto)", nombre: "BBVA (Roberto)", tipo: "banco", colorBadge: "bg-sky-100 text-sky-800 border-sky-200" },
  { id: "Scotiabank (Roberto)", nombre: "Scotiabank (Roberto)", tipo: "banco", colorBadge: "bg-rose-100 text-rose-800 border-rose-200" },
  { id: "Efectivo", nombre: "Efectivo", tipo: "efectivo", colorBadge: "bg-amber-100 text-amber-800 border-amber-200" },
];

