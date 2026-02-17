import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getVolatilidad } from '../services/api';

export default function VolatilidadView() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dias, setDias] = useState(30);

  const fetchData = (d: number) => {
    setLoading(true);
    setDias(d);
    getVolatilidad(d, 50)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(30); }, []);

  const top20 = data.slice(0, 20);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Ranking de Volatilidad</h2>
          <p className="text-sm text-gray-500">Productos con mayor variación de precio (coeficiente de variación)</p>
        </div>
        <div className="flex gap-2">
          {[7, 14, 30, 60, 90].map((d) => (
            <button
              key={d}
              onClick={() => fetchData(d)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors
                ${dias === d ? 'bg-agro-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Gráfico */}
      {!loading && top20.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-3">Top 20 — Mayor coeficiente de variación</h3>
          <ResponsiveContainer width="100%" height={500}>
            <BarChart data={top20} layout="vertical" margin={{ left: 120 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="producto" tick={{ fontSize: 11 }} width={110} />
              <Tooltip
                formatter={(value: number, name: string) => {
                  if (name === 'coef_variacion') return [`${value}%`, 'CV'];
                  return [value, name];
                }}
              />
              <Bar dataKey="coef_variacion" radius={[0, 4, 4, 0]}>
                {top20.map((_: any, i: number) => (
                  <Cell key={i} fill={i < 5 ? '#ef4444' : i < 10 ? '#f59e0b' : '#3b82f6'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">#</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Producto</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Cat.</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Mercado</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">CV %</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Precio Medio</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Desv. Est.</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Mín Período</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Máx Período</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Obs.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 10 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-200 rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : (
                data.map((d, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-400 font-mono text-xs">{i + 1}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-900">{d.producto}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium
                        ${d.categoria === 'fruta' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                        {d.categoria}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">{d.mercado}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-red-600">{d.coef_variacion}%</td>
                    <td className="px-4 py-2.5 text-right">${d.precio_medio?.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right text-gray-500">${d.desviacion?.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right text-green-600">${d.precio_min_periodo?.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right text-red-600">${d.precio_max_periodo?.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right text-gray-500">{d.observaciones}</td>
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
