import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, CalendarDays, RefreshCw, Settings2, Wallet } from "lucide-react";
import { useFeedback } from "../components/ui/Feedback";
import { CollapsibleSection } from "../components/ui/CollapsibleSection";
import { VoucherLightbox } from "../components/common/VoucherLightbox";
import { AlquilerHero } from "../components/alquiler/AlquilerHero";
import { PagoMensualidadForm } from "../components/alquiler/PagoMensualidadForm";
import { MesesAlquilerList } from "../components/alquiler/MesesAlquilerList";
import { EditarAlquilerForm } from "../components/alquiler/EditarAlquilerForm";

export const AlquilerDetallePage: React.FC = () => {
  const { notify } = useFeedback();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  // Cambia tras cada guardado para reiniciar formularios con los datos nuevos
  const [version, setVersion] = useState(0);

  const fetchDetalle = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch(`/api/alquileres/${id}`);
      if (!res.ok) throw new Error("No se pudo obtener el detalle del alquiler");
      setData(await res.json());
    } catch (err: any) {
      setErrorMsg(err.message || "Error al conectar con el servidor");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetalle();
  }, [fetchDetalle]);

  const refrescar = useCallback(
    async (mensaje?: string) => {
      if (mensaje) notify(mensaje, "success");
      await fetchDetalle();
      setVersion((v) => v + 1);
    },
    [fetchDetalle, notify]
  );

  const alquiler = data?.alquiler;

  if (isLoading && !alquiler) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-3">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-medium text-slate-500">Cargando contrato de alquiler...</p>
      </div>
    );
  }

  if (errorMsg || !alquiler || !id) {
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

  const estado = data.estado_calculado;
  const meses: any[] = estado?.mesesGenerados || [];
  const pagos: any[] = data.pagos || [];
  const idsEnMeses = new Set(meses.flatMap((m) => (m.pagos || []).map((p: any) => p.id)));
  const pagosSueltos = pagos.filter((p) => !idsEnMeses.has(p.id));
  const isFinalizado = alquiler.estado === "finalizado";
  const hoy = new Date();
  const prox = estado?.mesSiguiente;
  const sugerencia = prox
    ? { mes: prox.mes, anio: prox.anio, monto: Number(prox.saldoPendiente) || Number(alquiler.monto_mensual) }
    : { mes: hoy.getMonth() + 1, anio: hoy.getFullYear(), monto: Number(alquiler.monto_mensual) };
  const atrasados = Number(estado?.mesesAtrasados) || 0;

  return (
    <div className="space-y-4 pb-12 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 h-10 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors bg-transparent border-none cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        {isLoading && <RefreshCw className="w-4 h-4 text-slate-400 animate-spin" aria-label="Actualizando" />}
      </div>

      <AlquilerHero alquiler={alquiler} cliente={data.cliente} estado={estado} />

      {/* Celular: Registrar pago → Meses → Editar. Escritorio: acciones a la izquierda, historial a la derecha. */}
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:items-start">
        <div className="contents lg:block lg:col-span-5 lg:space-y-4">
          {!isFinalizado && (
            <CollapsibleSection className="order-1" title="Registrar pago de mensualidad" icon={<Wallet className="w-4 h-4" />} defaultOpen>
              <PagoMensualidadForm
                key={`pago-${version}`}
                alquilerId={id}
                sugerencia={sugerencia}
                onSuccess={(msg) => refrescar(msg)}
                onError={(msg) => notify(msg)}
              />
            </CollapsibleSection>
          )}
          <CollapsibleSection className="order-3" title="Editar contrato" icon={<Settings2 className="w-4 h-4" />}>
            <EditarAlquilerForm
              key={`edit-${version}`}
              alquiler={alquiler}
              onSaved={(msg) => refrescar(msg)}
              onError={(msg) => notify(msg)}
            />
          </CollapsibleSection>
        </div>

        <div className="contents lg:block lg:col-span-7">
          <CollapsibleSection
            className="order-2"
            title="Mensualidades"
            icon={<CalendarDays className="w-4 h-4" />}
            aside={atrasados > 0 ? <span className="text-rose-600">{atrasados} atrasada{atrasados > 1 ? "s" : ""}</span> : `${pagos.length} pago${pagos.length === 1 ? "" : "s"}`}
            defaultOpen
          >
            <MesesAlquilerList
              key={`meses-${version}`}
              alquilerId={id}
              meses={meses}
              pagosSueltos={pagosSueltos}
              onVerVoucher={setLightboxUrl}
              onChanged={(msg) => refrescar(msg)}
            />
          </CollapsibleSection>
        </div>
      </div>

      <VoucherLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
    </div>
  );
};

export default AlquilerDetallePage;
