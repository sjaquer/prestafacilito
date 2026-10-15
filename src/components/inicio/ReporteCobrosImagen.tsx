import React from "react";
import { GrupoCobro } from "../../lib/cobranza";
import { ItemCobro } from "./tipos";

interface ReporteCobrosImagenProps {
  items: ItemCobro[];
}

/** Grupos que entran al reporte, en orden. */
const SECCIONES: { grupo: GrupoCobro; titulo: string; color: string; fondo: string }[] = [
  { grupo: "atrasado", titulo: "ATRASADOS", color: "#b91c1c", fondo: "#fef2f2" },
  { grupo: "hoy", titulo: "COBRAR HOY", color: "#b45309", fondo: "#fffbeb" },
  { grupo: "manana", titulo: "MAÑANA", color: "#0369a1", fondo: "#f0f9ff" },
  { grupo: "semana", titulo: "ESTA SEMANA", color: "#4338ca", fondo: "#eef2ff" },
];

const soles = (n?: number) => (n === undefined || n === null ? "—" : `S/ ${n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const fecha = (iso?: string | null) => {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-PE", { day: "2-digit", month: "short" });
};

// Estilos tipo hoja de cálculo: bordes finos, sin adornos
const borde = "1px solid #d4d4d8";
const th: React.CSSProperties = { border: borde, padding: "7px 8px", fontSize: 12, fontWeight: 700, background: "#f4f4f5", color: "#3f3f46", textAlign: "left", whiteSpace: "nowrap" };
const td: React.CSSProperties = { border: borde, padding: "7px 8px", fontSize: 13, color: "#18181b", whiteSpace: "nowrap" };
const num: React.CSSProperties = { ...td, textAlign: "right", fontFamily: "Consolas, 'Courier New', monospace" };

/**
 * Imagen para enviar por WhatsApp: tabla simple estilo Excel con lo que hay que cobrar,
 * agrupado por urgencia, con capital restante e interés de cada préstamo.
 */
export const ReporteCobrosImagen: React.FC<ReporteCobrosImagenProps> = ({ items }) => {
  const hoy = new Date().toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const secciones = SECCIONES.map((s) => ({ ...s, filas: items.filter((i) => i.grupo === s.grupo) })).filter((s) => s.filas.length > 0);
  const totalGeneral = items.reduce((sum, i) => sum + i.montoACobrar, 0);
  let n = 0;

  return (
    <div
      id="reporte-cobros-container"
      style={{ background: "#ffffff", color: "#18181b", fontFamily: "'Segoe UI', Roboto, Arial, sans-serif", padding: 20, width: 920, boxSizing: "border-box" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>Cobros pendientes</div>
          <div style={{ fontSize: 13, color: "#52525b", textTransform: "capitalize" }}>{hoy}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, color: "#52525b" }}>Total a cobrar</div>
          <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "Consolas, 'Courier New', monospace" }}>{soles(totalGeneral)}</div>
        </div>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ ...th, width: 28, textAlign: "center" }}>#</th>
            <th style={th}>Cliente</th>
            <th style={th}>Tipo</th>
            <th style={{ ...th, textAlign: "right" }}>Capital restante</th>
            <th style={{ ...th, textAlign: "right" }}>Tasa</th>
            <th style={{ ...th, textAlign: "right" }}>Interés mes</th>
            <th style={th}>Fecha</th>
            <th style={{ ...th, textAlign: "right" }}>A cobrar</th>
          </tr>
        </thead>
        <tbody>
          {secciones.map((s) => (
            <React.Fragment key={s.grupo}>
              <tr>
                <td colSpan={7} style={{ ...td, background: s.fondo, color: s.color, fontWeight: 800, fontSize: 12, letterSpacing: 0.5 }}>
                  {s.titulo} ({s.filas.length})
                </td>
                <td style={{ ...num, background: s.fondo, color: s.color, fontWeight: 800 }}>{soles(s.filas.reduce((sum, i) => sum + i.montoACobrar, 0))}</td>
              </tr>
              {s.filas.map((i) => {
                n += 1;
                const atraso = s.grupo === "atrasado";
                return (
                  <tr key={`${i.es_alquiler ? "a" : "p"}-${i.id}`}>
                    <td style={{ ...td, textAlign: "center", color: "#71717a" }}>{n}</td>
                    <td style={{ ...td, fontWeight: 600, maxWidth: 230, overflow: "hidden", textOverflow: "ellipsis" }}>{i.cliente_nombre}</td>
                    <td style={{ ...td, color: "#52525b" }}>{i.es_alquiler ? `Alquiler` : i.tipo}</td>
                    <td style={num}>{i.es_alquiler ? "—" : soles(i.capital_restante)}</td>
                    <td style={num}>{i.es_alquiler ? "—" : `${i.tasa}%`}</td>
                    <td style={num}>{i.es_alquiler ? soles(i.renta_mensual) : soles(i.interes_mes)}</td>
                    <td style={{ ...td, color: atraso ? "#b91c1c" : "#18181b" }}>
                      {atraso ? `Desde ${fecha(i.debe_desde)} (${i.cuotas_atrasadas})` : fecha(i.proximo_cobro)}
                    </td>
                    <td style={{ ...num, fontWeight: 700 }}>{soles(i.montoACobrar)}</td>
                  </tr>
                );
              })}
            </React.Fragment>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 8, fontSize: 11, color: "#71717a" }}>
        Atrasados: interés vencido sin pagar (entre paréntesis, cuotas). En alquileres, "Interés mes" es la renta mensual.
      </div>
    </div>
  );
};
