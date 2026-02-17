import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getSpread } from '../services/api';

export default function SpreadView() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [catFilter, setCatFilter] = useState<string>('');

  useEffect(() => {
    getSpread()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = data.filter((d) => !catFilter || d.categoria === catFilter);
  const top20 = filtered.slice(0, 20);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Spread entre Mercados</h2>
          <p className="text-sm text-gray-500">Diferencia de precio del mismo producto entre mercados</p>
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

      {/* Gráfico de barras top 20 */}
      {!loading && top20.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-3">Top 20 — Mayor spread porcentual</h3>
          <ResponsiveContainer width="100%" height={500}>
            <BarChart data={top20} layout="vertical" margin={{ left: 120 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="producto" tick={{ fontSize: 11 }} width={110} />
              <Tooltip formatter={(value: number) => [`${value}%`, 'Spread']} />
              <Bar dataKey="spread_pct" radius={[0, 4, 4, 0]}>
                {top20.map((_: any, i: number) => (
                  <Cell key={i} fill={i < 5 ? '#ef4444' : i < 10 ? '#f59e0b' : '#22c55e'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tabla detallada */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Producto</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Cat.</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Más Barato</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Precio Mín</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Más Caro</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Precio Máx</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Spread</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Spread %</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Mercados</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-200 rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-400">Sin datos</td>
                </tr>
              ) : (
                filtered.map((d, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-900">{d.producto}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium
                        ${d.categoria === 'fruta' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                        {d.categoria}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-green-700 font-medium">{d.mercado_barato}</td>
                    <td className="px-4 py-2.5 text-right text-green-600">${d.precio_min_mercado?.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-red-700 font-medium">{d.mercado_caro}</td>
                    <td className="px-4 py-2.5 text-right text-red-600">${d.precio_max_mercado?.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right font-semibold">${d.spread?.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-amber-600">{d.spread_pct}%</td>
                    <td className="px-4 py-2.5 text-right text-gray-500">{d.num_mercados}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
