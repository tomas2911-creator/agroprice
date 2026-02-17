import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import Filters, { type FilterState } from './Filters';
import { getVariaciones } from '../services/api';

export default function VariacionesView() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dias, setDias] = useState(7);

  const fetchData = useCallback((filters?: FilterState) => {
    setLoading(true);
    const d = filters?.dias || dias;
    getVariaciones({
      dias: d,
      mercados: filters?.mercados?.length ? filters.mercados : undefined,
      productos: filters?.productos?.length ? filters.productos : undefined,
      categorias: filters?.categorias?.length ? filters.categorias : undefined,
    })
      .then((res) => {
        setData(res);
        setDias(d);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [dias]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Variaciones de Precio</h2>
          <p className="text-sm text-gray-500">Comparando con hace {dias} día(s)</p>
        </div>
        <Filters onFilterChange={fetchData} showDias />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Producto</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Cat.</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Mercado</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Precio Anterior</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Precio Actual</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Variación</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-200 rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">Sin datos de variación</td>
                </tr>
              ) : (
                data.map((d, i) => {
                  const pct = d.variacion_pct;
                  const isUp = pct > 0;
                  const isDown = pct < 0;
                  return (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-900">{d.producto}</td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium
                          ${d.categoria === 'fruta' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                          {d.categoria}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-600">{d.mercado}</td>
                      <td className="px-4 py-2.5 text-right text-gray-500">
                        ${d.precio_anterior?.toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-gray-900">
                        ${d.precio_actual?.toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={isUp ? 'text-green-600' : isDown ? 'text-red-600' : 'text-gray-400'}>
                          {isUp ? '+' : ''}{d.variacion_abs?.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={`inline-flex items-center gap-1 font-semibold
                          ${isUp ? 'text-green-600' : isDown ? 'text-red-600' : 'text-gray-400'}`}>
                          {isUp ? <TrendingUp size={14} /> : isDown ? <TrendingDown size={14} /> : <Minus size={14} />}
                          {isUp ? '+' : ''}{pct}%
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
