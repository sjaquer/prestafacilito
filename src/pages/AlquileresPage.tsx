import React, { useState, useEffect, useCallback } from "react";
import { Home, RefreshCw, Building2 } from "lucide-react";
import { Cliente, Alquiler } from "../types";
import { CrearAlquilerForm } from "../components/alquiler/CrearAlquilerForm";
import { RegistrarPagoAlquilerForm } from "../components/alquiler/RegistrarPagoAlquilerForm";
import { AlquilerCard, AlquilerItemCalculado } from "../components/alquiler/AlquilerCard";

export const AlquileresPage: React.FC = () => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [alquileres, setAlquileres] = useState<AlquilerItemCalculado[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAlquilerIdForPayment, setSelectedAlquilerIdForPayment] = useState<string>("");

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [clientesRes, alquileresRes] = await Promise.all([
        fetch("/api/clientes"),
        fetch("/api/alquileres")
      ]);

      if (clientesRes.ok) {
        const cData = await clientesRes.json();
        setClientes(cData || []);
      }

      if (alquileresRes.ok) {
        const aData = await alquileresRes.json();
        setAlquileres(aData || []);
      }
    } catch (err) {
      console.error("Error al cargar datos de alquileres:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAlquilerCreado = () => {
    loadData();
  };

  const handlePagoRegistrado = () => {
    loadData();
    setSelectedAlquilerIdForPayment("");
  };

  const handleSelectParaPago = (alquilerId: string) => {
    setSelectedAlquilerIdForPayment(alquilerId);
    const element = document.getElementById("seccion-pago-alquiler");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  const activos = alquileres.filter((a) => a.estado === "activo");

  return (
    <div className="space-y-6 pb-12">
      {/* Header de Alquileres */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 rounded-3xl text-white shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full text-xs font-semibold">
              Fase 8 — Módulo de Alquileres
            </span>
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
              <Home className="w-3.5 h-3.5" /> Total Activos: {activos.length}
            </span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">Gestión de Alquileres</h1>
          <p className="text-xs text-slate-300">
            Administración independiente de contratos de inmuebles, mensualidades fijas y cobros por período.
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-semibold rounded-xl transition-all shadow-sm self-start md:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          <span>Actualizar</span>
        </button>
      </div>

      {/* Grid Principal: 2 Columnas (38% Izquierda / 62% Derecha en Desktop) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Columna Izquierda (38% -> lg:col-span-5) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Formulario Fijo: Nuevo Contrato de Alquiler (Tarea 8.3.2) */}
          <CrearAlquilerForm
            clientes={clientes}
            onAlquilerCreado={handleAlquilerCreado}
          />

          {/* Formulario Fijo: Registrar Pago de Alquiler (Tarea 8.3.3) */}
          <div id="seccion-pago-alquiler">
            <RegistrarPagoAlquilerForm
              clientes={clientes}
              alquileresActivos={activos}
              selectedAlquilerIdFromParent={selectedAlquilerIdForPayment}
              onPagoRegistrado={handlePagoRegistrado}
            />
          </div>
        </div>

        {/* Columna Derecha (62% -> lg:col-span-7) */}
        <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              Contratos de Alquiler Activos
              <span className="px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded-full font-semibold">
                {activos.length}
              </span>
            </h2>
          </div>

          {isLoading ? (
            <div className="p-8 text-center flex flex-col items-center justify-center space-y-3 min-h-[300px]">
              <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs font-medium text-slate-500">Cargando alquileres...</p>
            </div>
          ) : activos.length === 0 ? (
            <div className="p-12 text-center border border-dashed border-slate-200 rounded-xl space-y-2">
              <Building2 className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs text-slate-500 font-medium">No hay contratos de alquiler activos en este momento.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activos.map((alq) => (
                <AlquilerCard
                  key={alq.id}
                  alquiler={alq}
                  onSelectParaPago={handleSelectParaPago}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AlquileresPage;
