import { useState, useEffect } from 'react';
import { getHeatmap } from '../services/api';

export default function HeatmapView() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [catFilter, setCatFilter] = useState<string>('');

  useEffect(() => {
    getHeatmap()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = data.filter((d) => !catFilter || d.categoria === catFilter);

  // Agrupar por producto × mercado (promedio de todos los formatos/unidades)
  const mercados = [...new Set(filtered.map((d) => d.mercado))].sort();
  const productosSet = new Set<string>();
  const precioAgg: Record<string, { sum: number; count: number }> = {};

  filtered.forEach((d) => {
    const prod = d.producto;
    productosSet.add(prod);
    const key = `${prod}|${d.mercado}`;
    if (!precioAgg[key]) precioAgg[key] = { sum: 0, count: 0 };
    precioAgg[key].sum += d.precio_promedio;
    precioAgg[key].count += 1;
  });
  const productos = [...productosSet].sort();

  // Mapa de precios promediados
  const precioMap: Record<string, number> = {};
  // Min/max por fila para escala relativa por producto
  const rowStats: Record<string, { min: number; max: number }> = {};
  Object.entries(precioAgg).forEach(([key, agg]) => {
    const avg = Math.round(agg.sum / agg.count);
    precioMap[key] = avg;
    const prod = key.split('|')[0];
    if (!rowStats[prod]) rowStats[prod] = { min: Infinity, max: 0 };
    if (avg < rowStats[prod].min) rowStats[prod].min = avg;
    if (avg > rowStats[prod].max) rowStats[prod].max = avg;
  });

  const getColor = (valor: number | undefined, prod: string) => {
    if (valor === undefined) return 'bg-gray-50';
    const stats = rowStats[prod];
    if (!stats || stats.max === stats.min) return 'bg-green-100 text-green-800';
    const pct = (valor - stats.min) / (stats.max - stats.min);
    if (pct < 0.25) return 'bg-green-100 text-green-800';
    if (pct < 0.5) return 'bg-green-200 text-green-900';
    if (pct < 0.75) return 'bg-yellow-100 text-yellow-800';
    return 'bg-orange-200 text-orange-900';
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-48" />
        <div className="h-96 bg-gray-200 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Heatmap de Precios</h2>
          <p className="text-sm text-gray-500">Precio promedio por producto × mercado (último boletín)</p>
        </div>
        <div className="flex gap-2">
          {['', 'fruta', 'hortaliza'].map((cat) => (
            <button
              key={cat}
              onClick={() => setCatFilter(cat)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors
                ${catFilter === cat ? 'bg-agro-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {cat === '' ? 'Todos' : cat === 'fruta' ? '🍎 Frutas' : '🥬 Hortalizas'}
            </button>
          ))}
        </div>
      </div>

      {productos.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Sin datos para mostrar</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="text-xs">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-500 sticky left-0 bg-white z-10 min-w-[140px]">
                    Producto
                  </th>
                  {mercados.map((m) => (
                    <th key={m} className="px-3 py-2 text-center font-medium text-gray-500 min-w-[100px]">
                      {m}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {productos.map((prod) => (
                  <tr key={prod} className="border-t border-gray-50">
                    <td className="px-3 py-1.5 font-medium text-gray-900 sticky left-0 bg-white z-10 whitespace-nowrap">
                      {prod}
                    </td>
                    {mercados.map((merc) => {
                      const valor = precioMap[`${prod}|${merc}`];
                      return (
                        <td key={merc} className={`px-3 py-1.5 text-center font-mono ${getColor(valor, prod)}`}>
                          {valor !== undefined ? `$${valor.toLocaleString()}` : '–'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Leyenda */}
          <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-500">
            <span>Escala:</span>
            <span className="px-2 py-0.5 bg-green-100 rounded">Bajo</span>
            <span className="px-2 py-0.5 bg-yellow-100 rounded">Medio</span>
            <span className="px-2 py-0.5 bg-orange-200 rounded">Alto</span>
            <span className="px-2 py-0.5 bg-red-200 rounded">Muy alto</span>
          </div>
        </div>
      )}
    </div>
  );
}
