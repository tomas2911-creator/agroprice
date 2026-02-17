import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getMercados, getProductos, getSubcategorias, getEstacionalidad } from '../services/api';

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function EstacionalidadView() {
  const [mercados, setMercados] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [selectedProducto, setSelectedProducto] = useState('');
  const [selectedMercado, setSelectedMercado] = useState('');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchProd, setSearchProd] = useState('');
  const [subcats, setSubcats] = useState<{variedades: string[], calidades: string[], unidades: string[]}>({variedades: [], calidades: [], unidades: []});
  const [selVariedad, setSelVariedad] = useState('');
  const [selCalidad, setSelCalidad] = useState('');
  const [selUnidad, setSelUnidad] = useState('');

  const selectProducto = (nombre: string) => {
    setSelectedProducto(nombre);
    setSearchProd(nombre);
    setSelVariedad(''); setSelCalidad(''); setSelUnidad('');
    getSubcategorias(nombre).then(setSubcats).catch(console.error);
  };

  useEffect(() => {
    Promise.all([getMercados(), getProductos()])
      .then(([m, p]) => { setMercados(m); setProductos(p); })
      .catch(console.error);
  }, []);

  const fetchData = () => {
    if (!selectedProducto) return;
    setLoading(true);
    setHasSearched(true);
    getEstacionalidad({
      producto: selectedProducto,
      mercado: selectedMercado || undefined,
      variedad: selVariedad || undefined,
      calidad: selCalidad || undefined,
      unidad: selUnidad || undefined,
    })
      .then(setData)
      .catch((err) => { console.error(err); setData([]); })
      .finally(() => setLoading(false));
  };

  // Transformar: agrupar por mes, una línea por año
  const chartData = () => {
    const byMes: Record<number, any> = {};
    for (let i = 1; i <= 12; i++) {
      byMes[i] = { mes: MESES[i - 1] };
    }
    data.forEach((d) => {
      byMes[d.mes][`${d.anio}`] = d.precio_promedio;
    });
    return Object.values(byMes);
  };

  const anios = [...new Set(data.map((d) => d.anio))].sort();
  const filteredProductos = productos.filter((p) =>
    !searchProd || p.nombre.toLowerCase().includes(searchProd.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-900">Análisis Estacional</h2>
      <p className="text-sm text-gray-500">Cómo se comporta el precio de un producto a lo largo del año</p>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* Producto */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Producto</label>
            <input
              type="text"
              placeholder="Buscar producto..."
              value={searchProd}
              onChange={(e) => setSearchProd(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
            <div className="mt-1 max-h-32 overflow-y-auto border border-gray-100 rounded-lg scrollbar-thin">
              {filteredProductos.map((p) => (
                <button
                  key={p.id}
                  onClick={() => selectProducto(p.nombre)}
                  className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50
                    ${selectedProducto === p.nombre ? 'bg-agro-50 text-agro-700 font-medium' : 'text-gray-700'}`}
                >
                  {p.nombre}
                </button>
              ))}
            </div>
          </div>

          {/* Sub-filtros */}
          {selectedProducto && (subcats.variedades.length > 1 || subcats.calidades.length > 1 || subcats.unidades.length > 1) && (
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Filtrar por</label>
              <div className="mt-1 space-y-1.5">
                {subcats.variedades.length > 1 && (
                  <select value={selVariedad} onChange={(e) => setSelVariedad(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm">
                    <option value="">Todas las variedades</option>
                    {subcats.variedades.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                )}
                {subcats.calidades.length > 1 && (
                  <select value={selCalidad} onChange={(e) => setSelCalidad(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm">
                    <option value="">Todas las calidades</option>
                    {subcats.calidades.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                )}
                {subcats.unidades.length > 1 && (
                  <select value={selUnidad} onChange={(e) => setSelUnidad(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm">
                    <option value="">Todas las unidades</option>
                    {subcats.unidades.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                )}
              </div>
            </div>
          )}

          {/* Mercado */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Mercado (opcional)</label>
            <select
              value={selectedMercado}
              onChange={(e) => setSelectedMercado(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
            >
              <option value="">Todos los mercados</option>
              {mercados.map((m) => (
                <option key={m.id} value={m.nombre}>{m.nombre}</option>
              ))}
            </select>
          </div>

          {/* Botón */}
          <div className="flex items-end">
            <button
              onClick={fetchData}
              disabled={!selectedProducto || loading}
              className="w-full px-4 py-2.5 bg-agro-600 text-white rounded-lg font-medium text-sm
                hover:bg-agro-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Cargando...' : 'Ver Estacionalidad'}
            </button>
          </div>
        </div>

        {/* Gráfico */}
        {data.length > 0 && (
          <div className="mt-6">
            <h3 className="font-semibold text-gray-900 mb-3">
              {selectedProducto} — Precio promedio mensual por año
            </h3>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartData()}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `$${v.toLocaleString()}`} />
                <Tooltip formatter={(value: number) => [`$${value?.toLocaleString()}`, '']} />
                <Legend />
                {anios.map((anio, i) => (
                  <Line key={anio} type="monotone" dataKey={`${anio}`}
                    stroke={COLORS[i % COLORS.length]} strokeWidth={2}
                    dot={{ r: 3 }} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {!loading && !hasSearched && (
          <p className="text-center text-gray-400 py-8">Selecciona un producto y presiona "Ver Estacionalidad"</p>
        )}
        {data.length === 0 && !loading && hasSearched && (
          <div className="text-center py-8">
            <p className="text-gray-500 font-medium">Sin resultados para esta combinación</p>
            <p className="text-gray-400 text-sm mt-1">Prueba quitando filtros o seleccionando otro mercado</p>
          </div>
        )}
      </div>
    </div>
  );
}
