import { useState, useEffect, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Area, ComposedChart, BarChart, Bar, Cell,
  ReferenceLine
} from 'recharts';
import { getMercados, getProductos, getSubcategorias, getPrediccion } from '../services/api';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, BarChart3, Calendar } from 'lucide-react';

const MESES_NOMBRE = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export default function PrediccionView() {
  const [mercados, setMercados] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [selectedProducto, setSelectedProducto] = useState('');
  const [selectedMercados, setSelectedMercados] = useState<string[]>([]);
  const [mesesFuturo, setMesesFuturo] = useState(12);
  const [searchProd, setSearchProd] = useState('');
  const [subcats, setSubcats] = useState<{variedades: string[], calidades: string[], unidades: string[]}>({variedades: [], calidades: [], unidades: []});
  const [selVariedad, setSelVariedad] = useState('');
  const [selCalidad, setSelCalidad] = useState('');
  const [selUnidad, setSelUnidad] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [result, setResult] = useState<any>(null);

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

  const fetchPrediccion = () => {
    if (!selectedProducto) return;
    setLoading(true);
    setHasSearched(true);
    getPrediccion({
      producto: selectedProducto,
      meses_futuro: mesesFuturo,
      mercados: selectedMercados.length ? selectedMercados : undefined,
      variedad: selVariedad || undefined,
      calidad: selCalidad || undefined,
      unidad: selUnidad || undefined,
    })
      .then(setResult)
      .catch((err) => { console.error(err); setResult(null); })
      .finally(() => setLoading(false));
  };

  // Combinar histórico + predicción para el gráfico principal
  const mainChartData = useMemo(() => {
    if (!result) return [];
    const hist = (result.historico || []).map((h: any) => ({
      mes: h.mes.substring(0, 7),
      precio_real: h.precio_promedio,
      tendencia: h.tendencia,
    }));
    const pred = (result.prediccion || []).map((p: any) => ({
      mes: p.mes.substring(0, 7),
      precio_predicho: p.precio_predicho,
      banda_min: p.precio_min,
      banda_max: p.precio_max,
    }));
    // Punto de unión
    if (hist.length > 0 && pred.length > 0) {
      const last = hist[hist.length - 1];
      pred[0].precio_real = last.precio_real;
    }
    return [...hist, ...pred];
  }, [result]);

  // Datos de estacionalidad
  const estacionalidadData = useMemo(() => {
    if (!result?.estacionalidad) return [];
    return result.estacionalidad.map((e: any) => ({
      ...e,
      nombre: MESES_NOMBRE[e.mes],
    }));
  }, [result]);

  const filteredProductos = productos.filter((p) =>
    !searchProd || p.nombre.toLowerCase().includes(searchProd.toLowerCase())
  );

  const tendencia = result?.tendencia;
  const metricas = result?.metricas;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-900">Predicción de Precios</h2>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
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
                  {p.nombre} <span className="text-gray-400 text-xs">({p.categoria})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Sub-filtros */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Filtrar por</label>
            <div className="mt-1 space-y-1.5">
              <select value={selVariedad} onChange={(e) => setSelVariedad(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
                disabled={!selectedProducto || subcats.variedades.length === 0}>
                <option value="">Todas las variedades</option>
                {subcats.variedades.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
              <select value={selCalidad} onChange={(e) => setSelCalidad(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
                disabled={!selectedProducto || subcats.calidades.length === 0}>
                <option value="">Todas las calidades</option>
                {subcats.calidades.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
              <select value={selUnidad} onChange={(e) => setSelUnidad(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
                disabled={!selectedProducto || subcats.unidades.length === 0}>
                <option value="">Todas las unidades</option>
                {subcats.unidades.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
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

          {/* Horizonte */}
          <div className="space-y-2">
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Horizonte</label>
              <div className="flex gap-1 mt-1 flex-wrap">
                {[3, 6, 12, 24].map((m) => (
                  <button key={m} onClick={() => setMesesFuturo(m)}
                    className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-lg border transition-colors
                      ${mesesFuturo === m
                        ? 'bg-agro-600 text-white border-agro-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                  >
                    {m} meses
                  </button>
                ))}
              </div>
            </div>
            <div className="text-[11px] text-gray-400 flex items-center gap-1">
              <AlertTriangle size={11} />
              Predicción estadística basada en datos históricos
            </div>
          </div>

          {/* Botón */}
          <div className="flex items-end">
            <button
              onClick={fetchPrediccion}
              disabled={!selectedProducto || loading}
              className="w-full px-4 py-2.5 bg-agro-600 text-white rounded-lg font-medium text-sm
                hover:bg-agro-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Calculando...' : 'Predecir Precios'}
            </button>
          </div>
        </div>

        {/* Error */}
        {result?.error && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
            <AlertTriangle size={16} className="inline mr-2" />
            {result.error}
          </div>
        )}

        {/* Resultados */}
        {result && !result.error && (
          <div className="space-y-6 mt-6">
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <KpiCard
                label="Precio Actual"
                value={`$${metricas?.precio_actual?.toLocaleString()}`}
                color="blue"
              />
              <KpiCard
                label="Tendencia"
                value={tendencia?.direccion === 'alza' ? 'Al alza' : tendencia?.direccion === 'baja' ? 'A la baja' : 'Estable'}
                sub={`${tendencia?.cambio_anual_pct > 0 ? '+' : ''}${tendencia?.cambio_anual_pct}% anual`}
                color={tendencia?.direccion === 'alza' ? 'green' : tendencia?.direccion === 'baja' ? 'red' : 'gray'}
                icon={tendencia?.direccion === 'alza' ? TrendingUp : tendencia?.direccion === 'baja' ? TrendingDown : Minus}
              />
              <KpiCard
                label="Cambio Mensual"
                value={`$${tendencia?.cambio_mensual > 0 ? '+' : ''}${tendencia?.cambio_mensual?.toLocaleString()}`}
                color={tendencia?.cambio_mensual >= 0 ? 'green' : 'red'}
              />
              <KpiCard
                label="Meses Historia"
                value={metricas?.meses_historia}
                icon={Calendar}
                color="purple"
              />
              <KpiCard
                label="Precisión (R²)"
                value={`${(metricas?.r_squared * 100).toFixed(0)}%`}
                sub={`MAPE: ${metricas?.mape}%`}
                color={metricas?.r_squared > 0.7 ? 'green' : metricas?.r_squared > 0.4 ? 'amber' : 'red'}
              />
              <KpiCard
                label="Precio Promedio"
                value={`$${metricas?.precio_promedio?.toLocaleString()}`}
                icon={BarChart3}
                color="gray"
              />
            </div>

            {/* Gráfico principal */}
            <div className="bg-white rounded-lg border border-gray-100 p-4">
              <h3 className="font-semibold text-gray-900 mb-3">
                {selectedProducto} — Histórico y Predicción de Precios
              </h3>
              <ResponsiveContainer width="100%" height={400}>
                <ComposedChart data={mainChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="mes" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${Number(v).toLocaleString()}`} />
                  <Tooltip
                    formatter={(value: number, name: string) => {
                      const labels: Record<string, string> = {
                        precio_real: 'Precio Real',
                        tendencia: 'Tendencia',
                        precio_predicho: 'Predicción',
                        banda_min: 'Banda Inferior',
                        banda_max: 'Banda Superior',
                      };
                      return [`$${Number(value).toLocaleString()}`, labels[name] || name];
                    }}
                  />
                  <Legend
                    formatter={(value) => {
                      const labels: Record<string, string> = {
                        precio_real: 'Precio Real',
                        tendencia: 'Tendencia',
                        precio_predicho: 'Predicción',
                        banda_min: 'Banda Inferior',
                        banda_max: 'Banda Superior',
                      };
                      return labels[value] || value;
                    }}
                  />
                  {/* Banda de confianza */}
                  <Area type="monotone" dataKey="banda_max" stroke="none" fill="#22c55e" fillOpacity={0.08} legendType="none" />
                  <Area type="monotone" dataKey="banda_min" stroke="none" fill="#ffffff" fillOpacity={1} legendType="none" />
                  <Line type="monotone" dataKey="banda_max" stroke="#22c55e" strokeWidth={1} strokeDasharray="4 4" dot={false} />
                  <Line type="monotone" dataKey="banda_min" stroke="#22c55e" strokeWidth={1} strokeDasharray="4 4" dot={false} />
                  {/* Tendencia */}
                  <Line type="monotone" dataKey="tendencia" stroke="#94a3b8" strokeWidth={1} strokeDasharray="6 3" dot={false} />
                  {/* Precio real */}
                  <Line type="monotone" dataKey="precio_real" stroke="#3b82f6" strokeWidth={2.5} dot={false} connectNulls />
                  {/* Predicción */}
                  <Line type="monotone" dataKey="precio_predicho" stroke="#22c55e" strokeWidth={2.5} dot={false} connectNulls />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Estacionalidad + Tabla predicción lado a lado */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Estacionalidad */}
              <div className="bg-white rounded-lg border border-gray-100 p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Patrón Estacional</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={estacionalidadData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="nombre" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v > 0 ? '+' : ''}${v}%`} />
                    <Tooltip formatter={(value: number) => [`${value > 0 ? '+' : ''}${value}%`, 'Variación']} />
                    <ReferenceLine y={0} stroke="#94a3b8" />
                    <Bar dataKey="variacion_pct" radius={[4, 4, 0, 0]}>
                      {estacionalidadData.map((entry: any, i: number) => (
                        <Cell key={i} fill={entry.variacion_pct >= 0 ? '#22c55e' : '#ef4444'} fillOpacity={0.8} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <p className="text-[11px] text-gray-400 mt-2 text-center">
                  Variación porcentual respecto al precio promedio por mes del año
                </p>
              </div>

              {/* Tabla de predicción */}
              <div className="bg-white rounded-lg border border-gray-100 p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Detalle de Predicción</h3>
                <div className="max-h-[300px] overflow-y-auto scrollbar-thin">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Mes</th>
                        <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">Precio Est.</th>
                        <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">Rango</th>
                        <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">Vol. Est.</th>
                        <th className="text-center px-3 py-2 text-xs font-medium text-gray-500">Confianza</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(result.prediccion || []).map((p: any, i: number) => {
                        const mesDate = new Date(p.mes + 'T12:00:00');
                        const mesLabel = mesDate.toLocaleDateString('es-CL', { month: 'short', year: 'numeric' });
                        return (
                          <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="px-3 py-2 font-medium text-gray-700 capitalize">{mesLabel}</td>
                            <td className="px-3 py-2 text-right font-mono font-semibold text-gray-900">
                              ${p.precio_predicho?.toLocaleString()}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-500 text-xs">
                              ${p.precio_min?.toLocaleString()} – ${p.precio_max?.toLocaleString()}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-500">
                              {p.volumen_esperado > 0 ? p.volumen_esperado.toLocaleString() : '—'}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium
                                ${p.confianza >= 70 ? 'bg-green-100 text-green-700' :
                                  p.confianza >= 40 ? 'bg-amber-100 text-amber-700' :
                                  'bg-red-100 text-red-700'}`}>
                                {p.confianza}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Volumen estacional */}
            <div className="bg-white rounded-lg border border-gray-100 p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Volumen Promedio por Mes</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={estacionalidadData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="nombre" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value: number) => [value.toLocaleString(), 'Volumen']} />
                  <Bar dataKey="volumen_promedio" fill="#3b82f6" fillOpacity={0.7} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Disclaimer */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-500">
              <strong>Nota:</strong> Esta predicción se basa en un modelo de descomposición estacional + tendencia lineal
              aplicado a los datos históricos de ODEPA. Los precios reales pueden variar significativamente debido a
              factores climáticos, económicos, de oferta/demanda y otros eventos no modelados. Use esta información
              como referencia, no como garantía de precios futuros.
              {metricas?.r_squared < 0.4 && (
                <span className="text-amber-600 font-medium ml-1">
                  ⚠ El modelo tiene baja precisión para este producto (R² = {metricas?.r_squared}). Los resultados deben interpretarse con cautela.
                </span>
              )}
            </div>
          </div>
        )}

        {!loading && !hasSearched && (
          <p className="text-center text-gray-400 py-8">Selecciona un producto y presiona "Predecir Precios"</p>
        )}
        {!result && !loading && hasSearched && (
          <div className="text-center py-8">
            <p className="text-gray-500 font-medium">No se pudo generar la predicción</p>
            <p className="text-gray-400 text-sm mt-1">Verifica que el producto tenga datos históricos suficientes</p>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, color = 'gray', icon: Icon }: {
  label: string; value: any; sub?: string; color?: string;
  icon?: React.ComponentType<any>;
}) {
  const colorMap: Record<string, string> = {
    green: 'bg-green-50 border-green-200 text-green-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    gray: 'bg-gray-50 border-gray-200 text-gray-700',
  };
  return (
    <div className={`rounded-lg border p-3 ${colorMap[color] || colorMap.gray}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase font-medium opacity-70">{label}</span>
        {Icon && <Icon size={14} className="opacity-50" />}
      </div>
      <div className="text-lg font-bold">{value}</div>
      {sub && <div className="text-[11px] opacity-70 mt-0.5">{sub}</div>}
    </div>
  );
}
