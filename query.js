import 'dotenv/config';
import { supabase } from './src/lib/supabase';

async function test() {
  const clienteId = '2d9f7455-8f26-4499-83ba-513ffa016960';
  
  // Clientes
  const { data: cliente } = await supabase.from('clientes').select('*').eq('id', clienteId).single();
  console.log('=== CLIENTE ===');
  console.log(cliente);
  
  // Prestamos
  const { data: prestamos } = await supabase.from('prestamos').select('*').eq('cliente_id', clienteId);
  console.log('\n=== PRESTAMOS ===');
  console.log(prestamos);
  
  if (prestamos && prestamos.length > 0) {
    for (const p of prestamos) {
      // Amortizaciones
      const { data: pagos } = await supabase.from('amortizaciones').select('*').eq('prestamo_id', p.id);
      console.log(`\n=== PAGOS PARA PRESTAMO ${p.id} ===`);
      console.log(pagos);
      
      // Ajustes
      const { data: ajustes } = await supabase.from('ajustes_prestamo').select('*').eq('prestamo_id', p.id);
      console.log(`\n=== AJUSTES PARA PRESTAMO ${p.id} ===`);
      console.log(ajustes);
    }
  }
}

test().catch(console.error);
