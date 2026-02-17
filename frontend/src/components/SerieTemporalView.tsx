import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getMercados, getProductos, getSerieTemporal } from '../services/api';

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

export default function SerieTemporalView() {
  const [mercados, setMercados] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [selectedProducto, setSelectedProducto] = useState('');
  const [selectedMercados, setSelectedMercados] = useState<string[]>([]);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchProd, setSearchProd] = useState('');

  useEffect(() => {
    Promise.all([getMercados(), getProductos()])
      .then(([m, p]) => { setMercados(m); setProductos(p); })
      .catch(console.error);
  }, []);

  const fetchSerie = () => {
    if (!selectedProducto) return;
    setLoading(true);
    getSerieTemporal({
      producto: selectedProducto,
      mercados: selectedMercados.length ? selectedMercados : undefined,
      fecha_inicio: fechaInicio || undefined,
      fecha_fin: fechaFin || undefined,
    })
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  // Transformar datos para Recharts: agrupar por fecha, una key por mercado
  const chartData = () => {
    const byDate: Record<string, any> = {};
    data.forEach((d) => {
      if (!byDate[d.fecha]) byDate[d.fecha] = { fecha: d.fecha };
      byDate[d.fecha][d.mercado] = d.precio_promedio;
    });
    return Object.values(byDate).sort((a: any, b: any) => a.fecha.localeCompare(b.fecha));
  };

  const mercadosInData = [...new Set(data.map((d) => d.mercado))];
  const filteredProductos = productos.filter((p) =>
    !searchProd || p.nombre.toLowerCase().includes(searchProd.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-900">Serie Temporal</h2>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
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
                  onClick={() => { setSelectedProducto(p.nombre); setSearchProd(p.nombre); }}
                  className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50
                    ${selectedProducto === p.nombre ? 'bg-agro-50 text-agro-700 font-medium' : 'text-gray-700'}`}
                >
                  {p.nombre} <span className="text-gray-400 text-xs">({p.categoria})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Mercados */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Mercados</label>
            <div className="mt-1 max-h-40 overflow-y-auto space-y-1 scrollbar-thin">
              {mercados.map((m) => (
                <label key={m.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedMercados.includes(m.nombre)}
                    onChange={() => {
                      setSelectedMercados((prev) =>
                        prev.includes(m.nombre) ? prev.filter((x) => x !== m.nombre) : [...prev, m.nombre]
                      );
                    }}
                    className="rounded text-agro-600"
                  />
                  {m.nombre}
                </label>
              ))}
            </div>
          </div>

          {/* Fechas */}
          <div className="space-y-2">
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Desde</label>
              <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Hasta</label>
              <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
          </div>

          {/* Botón */}
          <div className="flex items-end">
            <button
              onClick={fetchSerie}
              disabled={!selectedProducto || loading}
              className="w-full px-4 py-2.5 bg-agro-600 text-white rounded-lg font-medium text-sm
                hover:bg-agro-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Cargando...' : 'Ver Serie'}
            </button>
          </div>
        </div>

        {/* Gráfico */}
        {data.length > 0 && (
          <div className="mt-6">
            <h3 className="font-semibold text-gray-900 mb-3">
              {selectedProducto} — Evolución de Precio Promedio
            </h3>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartData()}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="fecha" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v.toLocaleString()}`} />
                <Tooltip formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
                  labelFormatter={(label) => `Fecha: ${label}`} />
                <Legend />
                {mercadosInData.map((m, i) => (
                  <Line key={m} type="monotone" dataKey={m} stroke={COLORS[i % COLORS.length]}
                    strokeWidth={2} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {data.length === 0 && !loading && selectedProducto && (
          <p className="text-center text-gray-400 py-8">Selecciona un producto y presiona "Ver Serie"</p>
        )}
      </div>
    </div>
  );
}
