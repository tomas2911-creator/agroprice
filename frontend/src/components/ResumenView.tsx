import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Package, MapPin, DollarSign } from 'lucide-react';
import { getResumen } from '../services/api';

export default function ResumenView() {
  const [resumen, setResumen] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getResumen()
      .then(setResumen)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSkeleton />;
  if (!resumen || !resumen.fecha) return (
    <div className="text-center py-20 text-gray-500">
      <Package size={48} className="mx-auto mb-4 opacity-50" />
      <p className="text-lg">No hay datos disponibles</p>
      <p className="text-sm mt-1">Aún no hay boletines importados</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Resumen del día</h2>
        <p className="text-gray-500 text-sm mt-1">Boletín del {resumen.fecha}</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard
          icon={<Package size={20} />}
          label="Productos"
          value={resumen.total_productos}
          color="blue"
        />
        <KpiCard
          icon={<MapPin size={20} />}
          label="Mercados"
          value={resumen.total_mercados}
          color="purple"
        />
        <KpiCard
          icon={<DollarSign size={20} />}
          label="Precio Promedio General"
          value={resumen.precio_promedio_general ? `$${resumen.precio_promedio_general.toLocaleString()}` : 'N/A'}
          color="green"
        />
      </div>

      {/* Top subidas y bajadas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={20} className="text-green-600" />
            <h3 className="font-semibold text-gray-900">Top Subidas (7 días)</h3>
          </div>
          {resumen.top_subidas.length === 0 ? (
            <p className="text-gray-400 text-sm">Sin datos</p>
          ) : (
            <div className="space-y-2">
              {resumen.top_subidas.map((item: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="font-medium text-sm text-gray-900">{item.producto}</p>
                    <p className="text-xs text-gray-500">{item.mercado}</p>
                    {(item.variedad || item.calidad || item.unidad) && (
                      <p className="text-xs text-gray-400">
                        {[item.variedad, item.calidad, item.unidad].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-green-600">+{item.variacion_pct}%</p>
                    <p className="text-xs text-gray-500">
                      ${item.precio_anterior?.toLocaleString()} → ${item.precio_actual?.toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown size={20} className="text-red-600" />
            <h3 className="font-semibold text-gray-900">Top Bajadas (7 días)</h3>
          </div>
          {resumen.top_bajadas.length === 0 ? (
            <p className="text-gray-400 text-sm">Sin datos</p>
          ) : (
            <div className="space-y-2">
              {resumen.top_bajadas.map((item: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="font-medium text-sm text-gray-900">{item.producto}</p>
                    <p className="text-xs text-gray-500">{item.mercado}</p>
                    {(item.variedad || item.calidad || item.unidad) && (
                      <p className="text-xs text-gray-400">
                        {[item.variedad, item.calidad, item.unidad].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-red-600">{item.variacion_pct}%</p>
                    <p className="text-xs text-gray-500">
                      ${item.precio_anterior?.toLocaleString()} → ${item.precio_actual?.toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    green: 'bg-green-50 text-green-600',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors[color]}`}>
          {icon}
        </div>
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-48" />
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-gray-200 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <div key={i} className="h-64 bg-gray-200 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
