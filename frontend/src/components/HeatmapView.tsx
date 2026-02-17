import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { getHeatmap } from '../services/api';

export default function HeatmapView() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [catFilter, setCatFilter] = useState<string>('');
  const [dias, setDias] = useState(1);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'nombre' | 'precio'>('nombre');

  const fetchData = (d: number) => {
    setLoading(true);
    setDias(d);
    getHeatmap({ dias: d > 1 ? d : undefined })
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(1); }, []);

  const filtered = data.filter((d) => !catFilter || d.categoria === catFilter);

  // Agrupar por producto × mercado
  const mercados = [...new Set(filtered.map((d) => d.mercado))].sort();
  const precioMap: Record<string, number> = {};
  const productosCats: Record<string, string> = {};

  filtered.forEach((d) => {
    const key = `${d.producto}|${d.mercado}`;
    precioMap[key] = d.precio_promedio;
    productosCats[d.producto] = d.categoria;
  });

  let productos = [...new Set(filtered.map((d) => d.producto))];

  // Filtro de búsqueda
  if (search) {
    const s = search.toLowerCase();
    productos = productos.filter((p) => p.toLowerCase().includes(s));
  }

  // Ordenar
  if (sortBy === 'nombre') {
    productos.sort();
  } else {
    productos.sort((a, b) => {
      const avgA = mercados.reduce((s, m) => s + (precioMap[`${a}|${m}`] || 0), 0) / mercados.length;
      const avgB = mercados.reduce((s, m) => s + (precioMap[`${b}|${m}`] || 0), 0) / mercados.length;
      return avgB - avgA;
    });
  }

  // Min/max por fila para escala relativa
  const rowStats: Record<string, { min: number; max: number }> = {};
  productos.forEach((prod) => {
    mercados.forEach((merc) => {
      const val = precioMap[`${prod}|${merc}`];
      if (val !== undefined) {
        if (!rowStats[prod]) rowStats[prod] = { min: Infinity, max: 0 };
        if (val < rowStats[prod].min) rowStats[prod].min = val;
        if (val > rowStats[prod].max) rowStats[prod].max = val;
      }
    });
  });

  const getColor = (valor: number | undefined, prod: string) => {
    if (valor === undefined) return 'bg-gray-50 text-gray-300';
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

  const periodLabel = dias === 1 ? 'último boletín' : `promedio ${dias} días`;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Heatmap de Precios</h2>
          <p className="text-sm text-gray-500">
            Precio promedio por producto × mercado ({periodLabel})
            <span className="ml-2 text-gray-400">· {productos.length} productos</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
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

      {/* Controles */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Período */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500 mr-1">Período:</span>
          {[{d: 1, l: 'Hoy'}, {d: 7, l: '7d'}, {d: 14, l: '14d'}, {d: 30, l: '30d'}].map(({d, l}) => (
            <button
              key={d}
              onClick={() => fetchData(d)}
              className={`px-2.5 py-1 rounded-md text-xs transition-colors
                ${dias === d ? 'bg-agro-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {l}
            </button>
          ))}
        </div>

        {/* Búsqueda */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar producto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs"
          />
        </div>

        {/* Ordenar */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500 mr-1">Ordenar:</span>
          <button
            onClick={() => setSortBy('nombre')}
            className={`px-2.5 py-1 rounded-md text-xs transition-colors
              ${sortBy === 'nombre' ? 'bg-agro-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            A-Z
          </button>
          <button
            onClick={() => setSortBy('precio')}
            className={`px-2.5 py-1 rounded-md text-xs transition-colors
              ${sortBy === 'precio' ? 'bg-agro-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            Precio ↓
          </button>
        </div>
      </div>

      {productos.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          {search ? `Sin resultados para "${search}"` : 'Sin datos para mostrar'}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="text-xs">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-500 sticky left-0 bg-gray-50 z-10 min-w-[140px] border-b border-gray-200">
                    Producto
                  </th>
                  {mercados.map((m) => (
                    <th key={m} className="px-3 py-2 text-center font-medium text-gray-500 min-w-[100px] border-b border-gray-200 bg-gray-50">
                      <span className="block truncate max-w-[100px]" title={m}>{m}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {productos.map((prod) => (
                  <tr key={prod} className="border-t border-gray-50 hover:bg-gray-50/50">
                    <td className="px-3 py-1.5 font-medium text-gray-900 sticky left-0 bg-white z-10 whitespace-nowrap">
                      <span className="flex items-center gap-1">
                        {productosCats[prod] === 'fruta'
                          ? <span className="w-1.5 h-1.5 rounded-full bg-orange-400 inline-block" />
                          : <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                        }
                        {prod}
                      </span>
                    </td>
                    {mercados.map((merc) => {
                      const valor = precioMap[`${prod}|${merc}`];
                      return (
                        <td
                          key={merc}
                          className={`px-3 py-1.5 text-center font-mono cursor-default ${getColor(valor, prod)}`}
                          title={valor !== undefined
                            ? `${prod} en ${merc}: $${valor.toLocaleString()}`
                            : `${prod}: sin datos en ${merc}`}
                        >
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
            <span>Escala (por fila):</span>
            <span className="px-2 py-0.5 bg-green-100 rounded">Más barato</span>
            <span className="px-2 py-0.5 bg-green-200 rounded">Bajo</span>
            <span className="px-2 py-0.5 bg-yellow-100 rounded">Medio</span>
            <span className="px-2 py-0.5 bg-orange-200 rounded">Más caro</span>
            <span className="ml-auto flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 inline-block" /> Fruta
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" /> Hortaliza
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
