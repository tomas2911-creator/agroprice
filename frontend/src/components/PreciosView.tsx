import { useState, useEffect, useCallback } from 'react';
import { Search } from 'lucide-react';
import Filters, { FilterState } from './Filters';
import { getPrecios } from '../services/api';

export default function PreciosView() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchData = useCallback((filters?: FilterState) => {
    setLoading(true);
    getPrecios({
      fecha_inicio: filters?.fechaInicio || undefined,
      fecha_fin: filters?.fechaFin || undefined,
      mercados: filters?.mercados?.length ? filters.mercados : undefined,
      productos: filters?.productos?.length ? filters.productos : undefined,
      categorias: filters?.categorias?.length ? filters.categorias : undefined,
      limit: 1000,
    })
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = data.filter((d) =>
    !search || d.producto.toLowerCase().includes(search.toLowerCase())
    || d.mercado.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-gray-900">Tabla de Precios</h2>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar producto o mercado..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm w-64"
            />
          </div>
          <Filters onFilterChange={fetchData} />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Fecha</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Mercado</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Producto</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Cat.</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Variedad</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Mín</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Máx</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Promedio</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Volumen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-200 rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-400">Sin resultados</td>
                </tr>
              ) : (
                filtered.map((d, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-600">{d.fecha}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-900">{d.mercado}</td>
                    <td className="px-4 py-2.5 text-gray-900">{d.producto}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium
                        ${d.categoria === 'fruta' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                        {d.categoria}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-500">{d.variedad || '-'}</td>
                    <td className="px-4 py-2.5 text-right text-gray-600">
                      {d.precio_min ? `$${d.precio_min.toLocaleString()}` : '-'}
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-600">
                      {d.precio_max ? `$${d.precio_max.toLocaleString()}` : '-'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-gray-900">
                      {d.precio_promedio ? `$${d.precio_promedio.toLocaleString()}` : '-'}
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-600">
                      {d.volumen ? d.volumen.toLocaleString() : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && (
          <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-500">
            Mostrando {filtered.length} de {data.length} registros
          </div>
        )}
      </div>
    </div>
  );
}
