import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  ArrowLeft, Home, Calendar, DollarSign, CheckCircle2, Clock, 
  AlertTriangle, RefreshCw, FileText, Check, ShieldAlert 
} from "lucide-react";

export const AlquilerDetallePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [alquiler, setAlquiler] = useState<any>(null);
  const [cliente, setCliente] = useState<any>(null);
  const [pagos, setPagos] = useState<any[]>([]);
  const [estadoCalculado, setEstadoCalculado] = useState<any>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  // Formulario Fijo de Pago de Mensualidad
  const [montoPago, setMontoPago] = useState("");
  const [mesPago, setMesPago] = useState<number>(new Date().getMonth() + 1);
  const [anioPago, setAnioPago] = useState<number>(new Date().getFullYear());
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().split("T")[0]);
  const [metodoPago, setMetodoPago] = useState("Efectivo");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pagoErrorMsg, setPagoErrorMsg] = useState("");

  // Finalizar Contrato
  const [isFinalizing, setIsFinalizing] = useState(false);

  const fetchDetalle = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch(`/api/alquileres/${id}`);
      if (!res.ok) {
        throw new Error("No se pudo obtener el detalle del alquiler");
      }

      const data = await res.json();
      const alquilerData = data.alquiler || (data.id ? data : null);
      setAlquiler(alquilerData);
      setCliente(data.cliente || null);
      setPagos(data.pagos || []);
      setEstadoCalculado(data.estado || data.estado_calculado || null);

      if (alquilerData) {
        setMontoPago(String(alquilerData.monto_mensual || ""));
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Error al conectar con el servidor");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetalle();
  }, [fetchDetalle]);

  const handlePagoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    const montoNum = parseFloat(montoPago);
    if (!montoNum || montoNum <= 0) {
      setPagoErrorMsg("El monto debe ser mayor a 0.");
      return;
    }

    setIsSubmitting(true);
    setPagoErrorMsg("");

    try {
      const res = await fetch(`/api/alquileres/${id}/pagos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monto: montoNum,
          periodo_mes: mesPago,
          periodo_anio: anioPago,
          fecha_pago: fechaPago,
          metodo_pago: metodoPago
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "No se pudo registrar el pago de alquiler");
      }

      await fetchDetalle();
    } catch (err: any) {
      setPagoErrorMsg(err.message || "Error al procesar el pago");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinalizarContrato = async () => {
    if (!id || !window.confirm(`¿Confirmar que el contrato de alquiler de "${alquiler?.descripcion_inmueble}" ha finalizado?`)) {
      return;
    }

    setIsFinalizing(true);
    try {
      const res = await fetch(`/api/alquileres/${id}/finalizar`, {
        method: "PUT"
      });

      if (res.ok) {
        await fetchDetalle();
      } else {
        alert("No se pudo finalizar el contrato.");
      }
    } catch (err) {
      console.error("Error al finalizar contrato:", err);
    } finally {
      setIsFinalizing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-3">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-medium text-slate-500">Cargando contrato de alquiler...</p>
      </div>
    );
  }

  if (errorMsg || !alquiler) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-2xl space-y-3">
        <p className="text-sm font-bold text-red-800">{errorMsg || "Contrato de alquiler no encontrado"}</p>
        <button
          onClick={() => navigate("/alquileres")}
          className="px-3 py-1.5 bg-white border border-slate-200 text-xs font-bold text-slate-700 rounded-xl"
        >
          ← Volver a Alquileres
        </button>
      </div>
    );
  }

  const isFinalizado = alquiler.estado === "finalizado";
  const MESES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  return (
    <div className="space-y-6 pb-12 max-w-6xl mx-auto">
      {/* Botón Volver y Cabecera del Contrato */}
      <div className="space-y-3">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                <Home className="w-5 h-5 text-indigo-600" /> {alquiler.descripcion_inmueble}
              </h1>
              {isFinalizado && (
                <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg border border-slate-200">
                  FINALIZADO
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 mt-1 font-semibold">
              Inquilino: <span className="font-bold text-slate-900">{cliente ? cliente.nombre_completo : "Desconocido"}</span>
              {cliente?.apodo && <span className="italic text-slate-500 font-semibold ml-1">({cliente.apodo})</span>}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Renta mensual: <span className="font-bold text-slate-800">S/ {alquiler.monto_mensual.toFixed(2)}</span> | Contrato desde: {alquiler.fecha_inicio} {alquiler.fecha_fin ? `hasta ${alquiler.fecha_fin}` : "(Indefinido)"}
            </p>
          </div>

          {!isFinalizado && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleFinalizarContrato}
                disabled={isFinalizing}
                className="px-3.5 py-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-bold rounded-xl transition-all disabled:opacity-50"
              >
                {isFinalizing ? "Finalizando..." : "Finalizar Contrato"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Grid Principal: Formulario Fijo de Cobro + Timeline por Mes */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Columna Izquierda: Formulario de Pago */}
        <div className="lg:col-span-5 space-y-6">
          {!isFinalizado && (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Registrar Pago de Mensualidad</h3>
                  <p className="text-xs text-slate-500">Cobro directo por mes de renta</p>
                </div>
              </div>

              {pagoErrorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
                  {pagoErrorMsg}
                </div>
              )}

              <form onSubmit={handlePagoSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Mes</label>
                    <select
                      value={mesPago}
                      onChange={(e) => setMesPago(parseInt(e.target.value, 10))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none"
                    >
                      {MESES.map((m, idx) => (
                        <option key={idx + 1} value={idx + 1}>{m}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Año</label>
                    <input
                      type="number"
                      value={anioPago}
                      onChange={(e) => setAnioPago(parseInt(e.target.value, 10))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Monto (S/)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.1"
                      value={montoPago}
                      onChange={(e) => setMontoPago(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Fecha Pago</label>
                    <input
                      type="date"
                      value={fechaPago}
                      onChange={(e) => setFechaPago(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Método de Pago</label>
                  <select
                    value={metodoPago}
                    onChange={(e) => setMetodoPago(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none"
                  >
                    <option value="Efectivo">Efectivo</option>
                    <option value="Yape">Yape</option>
                    <option value="Plin">Plin</option>
                    <option value="Transferencia BCP">Transferencia BCP</option>
                    <option value="Transferencia BBVA">Transferencia BBVA</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all disabled:opacity-50"
                >
                  {isSubmitting ? "Registrando..." : "Guardar Pago de Mensualidad"}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Columna Derecha: Timeline de Pagos por Mes (Tarea 8.3.5) */}
        <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-3">
            Historial de Pagos de Renta Registrados ({pagos.length})
          </h3>

          {pagos.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-slate-200 rounded-xl text-xs text-slate-500">
              No hay pagos registrados para este contrato aún.
            </div>
          ) : (
            <div className="space-y-3">
              {pagos.map((pago) => (
                <div
                  key={pago.id}
                  className="p-3.5 bg-emerald-50/40 border border-emerald-200/80 rounded-xl text-xs flex items-center justify-between gap-3"
                >
                  <div>
                    <span className="font-extrabold text-emerald-900 block">
                      {MESES[(pago.periodo_mes || 1) - 1]} {pago.periodo_anio} — S/ {pago.monto.toFixed(2)}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      Fecha de abono: {pago.fecha_pago} • Método: {pago.metodo_pago}
                    </span>
                  </div>

                  <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-lg text-xs flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> PAGADO
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AlquilerDetallePage;
