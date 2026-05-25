export interface Cliente {
  id: string;
  nombre_completo: string;
  telefono: string;
  observaciones: string;
  fecha_registro: string;
  prestamos_activos?: number;
  total_prestamos?: number;
  capital_total_prestado?: number;
  total_exigible?: number;
  total_amortizado?: number;
}

export interface Prestamo {
  id: string;
  cliente_id: string;
  monto_capital: number;
  tasa_interes_porcentaje: number;
  fecha_emision: string;
  fecha_vencimiento: string;
  estado: 'activo' | 'pagado';
  tipo_prestamo: string;
}

export interface Amortizacion {
  id: string;
  prestamo_id: string;
  tipo_movimiento: string;
  monto: number;
  fecha_pago: string;
  metodo_pago: string;
  comprobante_url?: string | null;
}

export interface CuotaPrestamo {
  numero: number;
  fechaVencimiento: string;
  capitalPendiente: number;
  interesPendiente: number;
  moraPendiente: number;
  penalidad: number;
  cargosAdicionales: number;
  montoCuotaBase: number;
  montoExigible: number;
  pagado: number;
  saldoPendiente: number;
  diasVencidos: number;
  estado: "Saldada" | "Pendiente" | "Vencida" | "Parcial";
}

export interface ResumenDeudaPrestamo {
  totalCuotas: number;
  cuotasPendientes: number;
  cuotasVencidas: number;
  capitalPendiente: number;
  interesPendiente: number;
  moraAcumulada: number;
  penalidadesAcumuladas: number;
  cargosAdicionalesAcumulados: number;
  totalExigible: number;
  totalPagado: number;
  saldoPendiente: number;
}

export interface EstadoDeudaPrestamo {
  resumen: ResumenDeudaPrestamo;
  cuotas: CuotaPrestamo[];
  cuotaSiguiente: CuotaPrestamo | null;
  cuotasVencidasDetalle: CuotaPrestamo[];
  clasificacionPagoSugerida?: string;
}
