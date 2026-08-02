import React from "react";
import { DeudorMesItem } from "./DeudoresMesList";

interface ReporteCobrosImagenProps {
  items: DeudorMesItem[];
}

export const ReporteCobrosImagen: React.FC<ReporteCobrosImagenProps> = ({ items }) => {
  const fechaHoyStr = new Date().toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
  const fechaHoyCapitalizada = fechaHoyStr.charAt(0).toUpperCase() + fechaHoyStr.slice(1);

  // Totales
  const totalAtrasado = items
    .filter((d) => d.estado_pago_mes === "atrasado")
    .reduce((sum, d) => sum + d.cuota_actual, 0);

  const totalPendienteSemana = items
    .filter((d) => d.estado_pago_mes === "pendiente")
    .reduce((sum, d) => sum + d.cuota_actual, 0);

  const totalGeneral = totalAtrasado + totalPendienteSemana;

  return (
    <div
      id="reporte-cobros-container"
      style={{
        backgroundColor: "#ffffff",
        color: "#0f172a",
        fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        padding: "24px",
        width: "900px",
        boxSizing: "border-box"
      }}
    >
      {/* Encabezado Principal Estilo Ejecutivo */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "3px solid #059669",
          paddingBottom: "14px",
          marginBottom: "16px"
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                backgroundColor: "#059669",
                borderRadius: "8px",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "900",
                fontSize: "20px"
              }}
            >
              P
            </div>
            <h1 style={{ margin: 0, fontSize: "24px", fontWeight: "900", color: "#0f172a" }}>
              PrestaFacilito
            </h1>
          </div>
          <p style={{ margin: "4px 0 0 0", fontSize: "12px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Reporte Semanal de Cobros y Vencimientos
          </p>
        </div>

        <div style={{ textAlign: "right" }}>
          <div
            style={{
              backgroundColor: "#d1fae5",
              color: "#065f46",
              border: "1px solid #6ee7b7",
              padding: "4px 12px",
              borderRadius: "9999px",
              fontSize: "11px",
              fontWeight: "900",
              display: "inline-block"
            }}
          >
            📋 LISTA PARA WHATSAPP
          </div>
          <p style={{ margin: "4px 0 0 0", fontSize: "11px", fontWeight: "600", color: "#64748b" }}>
            {fechaHoyCapitalizada}
          </p>
        </div>
      </div>

      {/* Tabla Estilo Excel Moderno */}
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "12px",
          textAlign: "left"
        }}
      >
        <thead>
          <tr style={{ backgroundColor: "#0f172a", color: "#ffffff" }}>
            <th style={{ padding: "10px 12px", fontWeight: "900", fontSize: "11px", textTransform: "uppercase", width: "40px" }}>#</th>
            <th style={{ padding: "10px 12px", fontWeight: "900", fontSize: "11px", textTransform: "uppercase", width: "230px" }}>Cliente / Inquilino</th>
            <th style={{ padding: "10px 12px", fontWeight: "900", fontSize: "11px", textTransform: "uppercase", width: "230px" }}>Concepto</th>
            <th style={{ padding: "10px 12px", fontWeight: "900", fontSize: "11px", textTransform: "uppercase", width: "150px" }}>Día de Cobro</th>
            <th style={{ padding: "10px 12px", fontWeight: "900", fontSize: "11px", textTransform: "uppercase", width: "110px", textAlign: "right" }}>Cuota (S/)</th>
            <th style={{ padding: "10px 12px", fontWeight: "900", fontSize: "11px", textTransform: "uppercase", width: "130px", textAlign: "center" }}>Estado</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            const isAtrasado = item.estado_pago_mes === "atrasado";
            const dayNum = item.dia_vencimiento_mes
              ? parseInt(item.dia_vencimiento_mes.split("-")[2] || item.dia_vencimiento_mes, 10)
              : 5;

            const isEven = index % 2 === 0;

            return (
              <tr
                key={item.prestamo_id}
                style={{
                  backgroundColor: isEven ? "#f8fafc" : "#ffffff",
                  borderBottom: "1px solid #e2e8f0"
                }}
              >
                <td style={{ padding: "10px 12px", fontWeight: "800", color: "#94a3b8" }}>{index + 1}</td>
                <td style={{ padding: "10px 12px" }}>
                  <span style={{ fontWeight: "800", color: "#0f172a", fontSize: "13px", display: "block" }}>
                    {item.cliente_nombre}
                  </span>
                  {item.cliente_apodo && (
                    <span style={{ fontSize: "11px", fontWeight: "600", color: "#64748b", fontStyle: "italic" }}>
                      ({item.cliente_apodo})
                    </span>
                  )}
                </td>
                <td style={{ padding: "10px 12px", fontWeight: "600" }}>
                  {item.es_alquiler ? (
                    <span style={{ color: "#4338ca", fontWeight: "700" }}>
                      🏠 Alquiler: {item.descripcion_inmueble || "Inmueble"}
                    </span>
                  ) : (
                    <span style={{ color: "#047857", fontWeight: "700" }}>
                      💰 Préstamo ({item.tipo_prestamo})
                    </span>
                  )}
                </td>
                <td style={{ padding: "10px 12px", fontWeight: "800", color: "#1e293b" }}>
                  📅 Día {dayNum}
                  {isAtrasado ? (
                    <span style={{ display: "block", fontSize: "10px", fontWeight: "900", color: "#dc2626", marginTop: "2px" }}>
                      ⚠️ Atrasado ({item.dias_atraso || 1}d)
                    </span>
                  ) : item.dias_restantes !== undefined && item.dias_restantes > 0 ? (
                    <span style={{ display: "block", fontSize: "10px", fontWeight: "800", color: "#b45309", marginTop: "2px" }}>
                      ⚡ Quedan {item.dias_restantes}d
                    </span>
                  ) : null}
                </td>
                <td style={{ padding: "10px 12px", fontWeight: "900", color: "#0f172a", fontSize: "14px", textAlign: "right" }}>
                  S/ {item.cuota_actual.toFixed(2)}
                </td>
                <td style={{ padding: "10px 12px", textAlign: "center" }}>
                  {isAtrasado ? (
                    <span
                      style={{
                        backgroundColor: "#dc2626",
                        color: "#ffffff",
                        padding: "5px 12px",
                        borderRadius: "9999px",
                        fontSize: "10px",
                        fontWeight: "900",
                        display: "inline-block",
                        whiteSpace: "nowrap",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.15)"
                      }}
                    >
                      🔴 POR COBRAR
                    </span>
                  ) : (
                    <span
                      style={{
                        backgroundColor: "#f59e0b",
                        color: "#0f172a",
                        padding: "5px 12px",
                        borderRadius: "9999px",
                        fontSize: "10px",
                        fontWeight: "900",
                        display: "inline-block",
                        whiteSpace: "nowrap",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.15)"
                      }}
                    >
                      ⚡ PENDIENTE
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Resumen de Totales al Pie */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "12px",
          backgroundColor: "#0f172a",
          color: "#ffffff",
          padding: "14px 16px",
          borderRadius: "12px",
          marginTop: "16px"
        }}
      >
        <div>
          <span style={{ fontSize: "10px", fontWeight: "800", color: "#fca5a5", textTransform: "uppercase", display: "block" }}>
            Total Por Cobrar (Atrasado)
          </span>
          <span style={{ fontSize: "16px", fontWeight: "900", color: "#fca5a5" }}>
            S/ {totalAtrasado.toFixed(2)}
          </span>
        </div>

        <div>
          <span style={{ fontSize: "10px", fontWeight: "800", color: "#fcd34d", textTransform: "uppercase", display: "block" }}>
            Total Pendiente Esta Semana
          </span>
          <span style={{ fontSize: "16px", fontWeight: "900", color: "#fcd34d" }}>
            S/ {totalPendienteSemana.toFixed(2)}
          </span>
        </div>

        <div style={{ borderLeft: "1px solid #334155", paddingLeft: "12px" }}>
          <span style={{ fontSize: "10px", fontWeight: "800", color: "#6ee7b7", textTransform: "uppercase", display: "block" }}>
            Gran Total a Recaudar
          </span>
          <span style={{ fontSize: "18px", fontWeight: "900", color: "#34d399" }}>
            S/ {totalGeneral.toFixed(2)}
          </span>
        </div>
      </div>

      <div style={{ textAlign: "center", paddingTop: "8px", borderTop: "1px solid #e2e8f0" }}>
        <p style={{ margin: 0, fontSize: "10px", fontWeight: "700", color: "#94a3b8" }}>
          PrestaFacilito v2.0 • Sistema de Gestión de Préstamos y Alquileres
        </p>
      </div>
    </div>
  );
};
