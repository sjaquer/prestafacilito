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
}
