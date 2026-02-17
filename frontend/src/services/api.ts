const API_BASE = import.meta.env.VITE_API_URL || '';

async function fetchJSON(url: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${url}`, options);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return res.json();
}

// Datos base
export const getMercados = () => fetchJSON('/api/mercados');
export const getProductos = (categoria?: string) =>
  fetchJSON(`/api/productos${categoria ? `?categoria=${categoria}` : ''}`);
export const getSubcategorias = (producto: string) =>
  fetchJSON(`/api/producto/subcategorias?producto=${encodeURIComponent(producto)}`);
export const getFechas = () => fetchJSON('/api/fechas');

// Precios
export const getPrecios = (params: {
  fecha_inicio?: string;
  fecha_fin?: string;
  mercados?: string[];
  productos?: string[];
  categorias?: string[];
  limit?: number;
}) => {
  const sp = new URLSearchParams();
  if (params.fecha_inicio) sp.set('fecha_inicio', params.fecha_inicio);
  if (params.fecha_fin) sp.set('fecha_fin', params.fecha_fin);
  if (params.mercados?.length) sp.set('mercados', params.mercados.join(','));
  if (params.productos?.length) sp.set('productos', params.productos.join(','));
  if (params.categorias?.length) sp.set('categorias', params.categorias.join(','));
  if (params.limit) sp.set('limit', String(params.limit));
  return fetchJSON(`/api/precios?${sp.toString()}`);
};

// Resumen diario
export const getResumen = (params?: { fecha?: string; mercado?: string }) => {
  const sp = new URLSearchParams();
  if (params?.fecha) sp.set('fecha', params.fecha);
  if (params?.mercado) sp.set('mercado', params.mercado);
  const qs = sp.toString();
  return fetchJSON(`/api/resumen${qs ? `?${qs}` : ''}`);
};

// Variaciones
export const getVariaciones = (params: {
  dias?: number;
  mercados?: string[];
  productos?: string[];
  categorias?: string[];
}) => {
  const sp = new URLSearchParams();
  if (params.dias) sp.set('dias', String(params.dias));
  if (params.mercados?.length) sp.set('mercados', params.mercados.join(','));
  if (params.productos?.length) sp.set('productos', params.productos.join(','));
  if (params.categorias?.length) sp.set('categorias', params.categorias.join(','));
  return fetchJSON(`/api/variaciones?${sp.toString()}`);
};

// Serie temporal
export const getSerieTemporal = (params: {
  producto: string;
  mercados?: string[];
  fecha_inicio?: string;
  fecha_fin?: string;
  variedad?: string;
  calidad?: string;
  unidad?: string;
}) => {
  const sp = new URLSearchParams();
  sp.set('producto', params.producto);
  if (params.mercados?.length) sp.set('mercados', params.mercados.join(','));
  if (params.fecha_inicio) sp.set('fecha_inicio', params.fecha_inicio);
  if (params.fecha_fin) sp.set('fecha_fin', params.fecha_fin);
  if (params.variedad) sp.set('variedad', params.variedad);
  if (params.calidad) sp.set('calidad', params.calidad);
  if (params.unidad) sp.set('unidad', params.unidad);
  return fetchJSON(`/api/serie-temporal?${sp.toString()}`);
};

// Spread entre mercados
export const getSpread = (fecha?: string) =>
  fetchJSON(`/api/spread${fecha ? `?fecha=${fecha}` : ''}`);

// Volatilidad
export const getVolatilidad = (dias?: number, limit?: number) => {
  const sp = new URLSearchParams();
  if (dias) sp.set('dias', String(dias));
  if (limit) sp.set('limit', String(limit));
  return fetchJSON(`/api/volatilidad?${sp.toString()}`);
};

// Estacionalidad
export const getEstacionalidad = (params: {
  producto: string;
  mercado?: string;
  variedad?: string;
  calidad?: string;
  unidad?: string;
}) => {
  const sp = new URLSearchParams();
  sp.set('producto', params.producto);
  if (params.mercado) sp.set('mercado', params.mercado);
  if (params.variedad) sp.set('variedad', params.variedad);
  if (params.calidad) sp.set('calidad', params.calidad);
  if (params.unidad) sp.set('unidad', params.unidad);
  return fetchJSON(`/api/estacionalidad?${sp.toString()}`);
};

// Correlaciones
export const getCorrelaciones = (params: {
  producto: string;
  mercado: string;
  topN?: number;
  variedad?: string;
  calidad?: string;
  unidad?: string;
}) => {
  const sp = new URLSearchParams();
  sp.set('producto', params.producto);
  sp.set('mercado', params.mercado);
  if (params.topN) sp.set('top_n', String(params.topN));
  if (params.variedad) sp.set('variedad', params.variedad);
  if (params.calidad) sp.set('calidad', params.calidad);
  if (params.unidad) sp.set('unidad', params.unidad);
  return fetchJSON(`/api/correlaciones?${sp.toString()}`);
};

// Heatmap
export const getHeatmap = (fecha?: string) =>
  fetchJSON(`/api/heatmap${fecha ? `?fecha=${fecha}` : ''}`);

// Export CSV
export const exportCSV = (params: {
  fecha_inicio?: string;
  fecha_fin?: string;
  mercados?: string[];
  productos?: string[];
  categorias?: string[];
}) => {
  const sp = new URLSearchParams();
  if (params.fecha_inicio) sp.set('fecha_inicio', params.fecha_inicio);
  if (params.fecha_fin) sp.set('fecha_fin', params.fecha_fin);
  if (params.mercados?.length) sp.set('mercados', params.mercados.join(','));
  if (params.productos?.length) sp.set('productos', params.productos.join(','));
  if (params.categorias?.length) sp.set('categorias', params.categorias.join(','));
  window.open(`${API_BASE}/api/export/csv?${sp.toString()}`, '_blank');
};
