import React, { useState, useEffect, useCallback } from "react";
import { Wallet, TrendingUp, AlertCircle, Coins, RefreshCw, CalendarDays } from "lucide-react";
import { Cliente, Prestamo } from "../types";
import { CrearPrestamoForm } from "./dashboard/CrearPrestamoForm";
import { RegistrarPagoForm } from "./dashboard/RegistrarPagoForm";
import { DeudoresMesList, DeudorMesItem } from "./dashboard/DeudoresMesList";

export const Dashboard: React.FC = () => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [prestamosActivos, setPrestamosActivos] = useState<Prestamo[]>([]);
  const [deudoresDelMes, setDeudoresDelMes] = useState<DeudorMesItem[]>([]);
  const [resumenCartera, setResumenCartera] = useState({
    totalActivoCount: 0,
    totalCapitalEnCirculacion: 0,
    totalCobradoEsteMes: 0,
    prestamosAtrasadosCount: 0
  });

  const [isLoading, setIsLoading] = useState(true);
  const [selectedPrestamoIdForPayment, setSelectedPrestamoIdForPayment] = useState<string>("");

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [homeRes, clientesRes, prestamosRes] = await Promise.all([
        fetch("/api/dashboard/home"),
        fetch("/api/clientes"),
        fetch("/api/prestamos")
      ]);

      if (homeRes.ok) {
        const homeData = await homeRes.json();
        setDeudoresDelMes(homeData.deudoresDelMes || []);
        if (homeData.resumenCartera) {
          setResumenCartera(homeData.resumenCartera);
        }
      }

      if (clientesRes.ok) {
        const clientesData = await clientesRes.json();
        setClientes(clientesData || []);
      }

      if (prestamosRes.ok) {
        const prestamosData = await prestamosRes.json();
        setPrestamosActivos(prestamosData || []);
      }
    } catch (err) {
      console.error("Error al cargar los datos del Centro de Control:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleClienteCreado = (nuevoCliente: Cliente) => {
    setClientes((prev) => [...prev, nuevoCliente]);
  };

  const handlePrestamoCreado = (_nuevoPrestamo: Prestamo) => {
    loadData();
  };

  const handlePagoRegistrado = () => {
    loadData();
    setSelectedPrestamoIdForPayment("");
  };

  const handleSelectDeudorParaPago = (prestamoId: string) => {
    setSelectedPrestamoIdForPayment(prestamoId);
    // Hacer scroll suave hacia la sección de registro de pago en dispositivos móviles
    const element = document.getElementById("seccion-registrar-pago");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  const nombreMesActual = new Date().toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  const mesCapitalizado = nombreMesActual.charAt(0).toUpperCase() + nombreMesActual.slice(1);

  return (
    <div className="space-y-6 pb-12">
      {/* Header Principal del Centro de Control */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 p-6 rounded-3xl text-white shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-xs font-semibold">
              Fase 4 — Centro de Control
            </span>
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <CalendarDays className="w-3.5 h-3.5 text-slate-400" /> {mesCapitalizado}
            </span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">Centro de Control Operativo</h1>
          <p className="text-xs text-slate-300">
            Formularios de registro directo, previsualización reactiva de cuotas y seguimiento integral de deudores.
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-semibold rounded-xl transition-all shadow-sm self-start md:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          <span>Actualizar Datos</span>
        </button>
      </div>

      {/* Barra de Métricas de Cartera */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">Capital en Circulación</p>
            <p className="text-xl font-bold text-slate-900">S/ {resumenCartera.totalCapitalEnCirculacion.toFixed(2)}</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Coins className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">Cobrado este Mes</p>
            <p className="text-xl font-bold text-emerald-600">S/ {resumenCartera.totalCobradoEsteMes.toFixed(2)}</p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">Préstamos Activos</p>
            <p className="text-xl font-bold text-slate-900">{resumenCartera.totalActivoCount}</p>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Wallet className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">Préstamos Atrasados</p>
            <p className="text-xl font-bold text-red-600">{resumenCartera.prestamosAtrasadosCount}</p>
          </div>
          <div className="p-3 bg-red-50 text-red-600 rounded-xl">
            <AlertCircle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Grid Principal: 2 Columnas (40% Formulario Izquierda / 60% Lista Derecha en Desktop) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Columna Izquierda (40% -> lg:col-span-5) */}
        <div className="lg:col-span-5 space-y-6">
          {/* SECCIÓN A: Formulario de Crear Nuevo Préstamo */}
          <CrearPrestamoForm
            clientes={clientes}
            onPrestamoCreado={handlePrestamoCreado}
            onClienteCreado={handleClienteCreado}
          />

          {/* SECCIÓN B: Formulario de Registrar Pago */}
          <div id="seccion-registrar-pago">
            <RegistrarPagoForm
              clientes={clientes}
              prestamosActivos={prestamosActivos}
              selectedPrestamoIdFromParent={selectedPrestamoIdForPayment}
              onPagoRegistrado={handlePagoRegistrado}
            />
          </div>
        </div>

        {/* Columna Derecha (60% -> lg:col-span-7) */}
        <div className="lg:col-span-7">
          {/* SECCIÓN C: Lista Completa de Deudores del Mes Actual */}
          <DeudoresMesList
            deudores={deudoresDelMes}
            onSelectDeudorParaPago={handleSelectDeudorParaPago}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
