/**
 * Supabase devuelve como máximo 1000 filas por consulta. Para respaldos y exportaciones
 * hay que pedir todas las páginas, o los datos quedan cortados sin aviso.
 */
const PAGINA = 1000;

type Pagina<T> = (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/** Recorre todas las páginas. La consulta debe tener un orden estable (p. ej. por `id`). */
export async function traerTodasLasPaginas<T>(consulta: Pagina<T>, descripcion: string): Promise<T[]> {
  const filas: T[] = [];
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await consulta(desde, desde + PAGINA - 1);
    if (error) throw new Error(`No se pudo leer ${descripcion}: ${error.message}`);
    filas.push(...(data || []));
    if (!data || data.length < PAGINA) return filas;
  }
}

/**
 * Igual que una consulta de Supabase (`{ data, error }`), pero trae TODAS las filas por páginas.
 * `armar` debe devolver una consulta nueva cada vez (sin `.range()`); se le agrega orden por `id`
 * como desempate para que las páginas no se salten ni repitan filas.
 */
export async function todas<T = any>(armar: () => any): Promise<{ data: T[]; error: { message: string } | null }> {
  try {
    const data = await traerTodasLasPaginas<T>((desde, hasta) => armar().order("id", { ascending: true }).range(desde, hasta), "la consulta");
    return { data, error: null };
  } catch (err: any) {
    return { data: [], error: { message: err.message } };
  }
}
