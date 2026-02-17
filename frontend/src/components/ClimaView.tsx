import { useState, useEffect } from 'react';
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer
} from 'recharts';
import { CloudRain, Thermometer, Sun, Wind, AlertTriangle, Search, RefreshCw } from 'lucide-react';
import {
  getMercados, getProductos, getClimaPrecio, getClimaAlertas,
  getClimaCorrelacion, importarClima
} from '../services/api';

const VARIABLES = [
  { key: 'temp_max', label: 'Temp. Máxima', icon: Thermometer, unit: '°C', color: '#ef4444' },
  { key: 'temp_min', label: 'Temp. Mínima', icon: Thermometer, unit: '°C', color: '#3b82f6' },
  { key: 'precipitacion', label: 'Precipitación', icon: CloudRain, unit: 'mm', color: '#06b6d4' },
  { key: 'humedad', label: 'Humedad', icon: CloudRain, unit: '%', color: '#8b5cf6' },
  { key: 'radiacion_solar', label: 'Radiación Solar', icon: Sun, unit: 'MJ/m²', color: '#f59e0b' },
  { key: 'viento_max', label: 'Viento Máx.', icon: Wind, unit: 'km/h', color: '#64748b' },
];

const PERIODOS = [
  { dias: 30, label: '30d' },
  { dias: 90, label: '90d' },
  { dias: 180, label: '6m' },
  { dias: 365, label: '1 año' },
];

const ALERTA_STYLE: Record<string, { emoji: string; label: string; cls: string }> = {
  helada: { emoji: '❄️', label: 'Helada', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  lluvia_intensa: { emoji: '🌧️', label: 'Lluvia Intensa', cls: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  ola_calor: { emoji: '🔥', label: 'Ola de Calor', cls: 'bg-red-50 text-red-700 border-red-200' },
  viento_fuerte: { emoji: '💨', label: 'Viento Fuerte', cls: 'bg-gray-50 text-gray-700 border-gray-200' },
};

function corrColor(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 0.7) return v > 0 ? 'text-green-700' : 'text-red-700';
  if (abs >= 0.4) return v > 0 ? 'text-green-600' : 'text-red-600';
  return 'text-gray-500';
}

function corrBg(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 0.7) return v > 0 ? 'bg-green-50' : 'bg-red-50';
  if (abs >= 0.4) return v > 0 ? 'bg-green-50/50' : 'bg-red-50/50';
  return 'bg-gray-50';
}

function varLabel(key: string): string {
  return VARIABLES.find((v) => v.key === key)?.label || key;
}

export default function ClimaView() {
  const [productos, setProductos] = useState<any[]>([]);
  const [mercados, setMercados] = useState<any[]>([]);
  const [selectedProducto, setSelectedProducto] = useState('');
  const [selectedMercado, setSelectedMercado] = useState('');
  const [selectedVariable, setSelectedVariable] = useState('temp_max');
  const [dias, setDias] = useState(90);
  const [searchProd, setSearchProd] = useState('');

  const [chartData, setChartData] = useState<any>(null);
  const [alertas, setAlertas] = useState<any[]>([]);
  const [correlaciones, setCorrelaciones] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingCorr, setLoadingCorr] = useState(false);
  const [importing, setImporting] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    Promise.all([getProductos(), getMercados()])
      .then(([p, m]) => { setProductos(p); setMercados(m); })
      .catch(console.error);
    getClimaAlertas().then(setAlertas).catch(() => setAlertas([]));
  }, []);

  const fetchChart = () => {
    if (!selectedProducto) return;
    setLoading(true);
    setHasSearched(true);
    getClimaPrecio({
      producto: selectedProducto,
      mercado: selectedMercado || undefined,
      dias,
      variable: selectedVariable,
    })
      .then(setChartData)
      .catch((err) => { console.error(err); setChartData(null); })
      .finally(() => setLoading(false));

    setLoadingCorr(true);
    getClimaCorrelacion(selectedProducto, Math.max(dias, 180))
      .then(setCorrelaciones)
      .catch(() => setCorrelaciones([]))
      .finally(() => setLoadingCorr(false));
  };

  const handleImport = () => {
    if (!confirm('¿Importar datos climáticos de los últimos 90 días para todas las zonas?')) return;
    setImporting(true);
    importarClima(90)
      .then((r: any) => alert(`Importado: ${r.registros_total} registros de ${r.zonas} zonas`))
      .catch((e: any) => alert(`Error: ${e.message}`))
      .finally(() => setImporting(false));
  };

  const filteredProductos = productos.filter((p: any) =>
    !searchProd || p.nombre.toLowerCase().includes(searchProd.toLowerCase())
  );

  const selVar = VARIABLES.find((v) => v.key === selectedVariable) || VARIABLES[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CloudRain className="w-6 h-6 text-cyan-600" />
            Clima × Precios
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            Correlación entre variables climáticas de zonas de producción y precios de mercado
          </p>
        </div>
        <button
          onClick={handleImport}
          disabled={importing}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-50 text-cyan-700 rounded-lg hover:bg-cyan-100 border border-cyan-200 disabled:opacity-50 text-sm font-medium"
        >
          <RefreshCw className={`w-4 h-4 ${importing ? 'animate-spin' : ''}`} />
          {importing ? 'Importando…' : 'Importar Clima'}
        </button>
      </div>

      {/* Alertas climáticas recientes */}
      {alertas.length > 0 && (
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <h3 className="text-sm font-semibold text-amber-600 flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4" />
            Alertas Climáticas Recientes (7 días)
          </h3>
          <div className="flex flex-wrap gap-2">
            {alertas.slice(0, 12).map((a: any, i: number) => {
              const st = ALERTA_STYLE[a.tipo_alerta] || ALERTA_STYLE.helada;
              return (
                <div key={i} className={`px-3 py-1.5 rounded-lg border text-xs ${st.cls}`}>
                  <span className="mr-1">{st.emoji}</span>
                  <span className="font-medium">{st.label}</span>
                  <span className="ml-2 opacity-70">{a.zona}</span>
                  <span className="ml-2 opacity-50">{a.fecha}</span>
                  {a.tipo_alerta === 'helada' && <span className="ml-1">({a.temp_min}°C)</span>}
                  {a.tipo_alerta === 'lluvia_intensa' && <span className="ml-1">({a.precipitacion}mm)</span>}
                  {a.tipo_alerta === 'ola_calor' && <span className="ml-1">({a.temp_max}°C)</span>}
                  {a.tipo_alerta === 'viento_fuerte' && <span className="ml-1">({a.viento_max}km/h)</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Controles */}
      <div className="bg-white rounded-xl p-5 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Producto */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Producto</label>
            <div className="relative mt-1">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar producto…"
                value={searchProd}
                onChange={(e) => setSearchProd(e.target.value)}
                className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:ring-1 focus:ring-agro-500 focus:border-agro-500"
              />
            </div>
            <div className="mt-1 max-h-32 overflow-y-auto border border-gray-100 rounded-lg scrollbar-thin">
              {filteredProductos.map((p: any) => (
                <button
                  key={p.nombre}
                  onClick={() => { setSelectedProducto(p.nombre); setSearchProd(p.nombre); }}
                  className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50
                    ${selectedProducto === p.nombre ? 'bg-agro-50 text-agro-700 font-medium' : 'text-gray-700'}`}
                >
                  {p.nombre} <span className="text-gray-400 text-xs">({p.categoria})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Mercado + Variable */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Mercado (opcional)</label>
              <select
                value={selectedMercado}
                onChange={(e) => setSelectedMercado(e.target.value)}
                className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Todos los mercados</option>
                {mercados.map((m: any) => (
                  <option key={m.nombre} value={m.nombre}>{m.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Variable Climática</label>
              <div className="grid grid-cols-2 gap-1 mt-1">
                {VARIABLES.map((v) => {
                  const Icon = v.icon;
                  return (
                    <button
                      key={v.key}
                      onClick={() => setSelectedVariable(v.key)}
                      className={`flex items-center gap-1 px-2 py-1.5 rounded text-xs border transition-colors ${
                        selectedVariable === v.key
                          ? 'bg-agro-50 border-agro-300 text-agro-700 font-medium'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                      {v.label.split(' ')[0]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Período */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Período</label>
            <div className="flex gap-1 mt-1">
              {PERIODOS.map((p) => (
                <button
                  key={p.dias}
                  onClick={() => setDias(p.dias)}
                  className={`flex-1 px-2 py-2 rounded text-xs border transition-colors ${
                    dias === p.dias
                      ? 'bg-agro-50 border-agro-300 text-agro-700 font-medium'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Info zona */}
            {chartData?.zona && (
              <div className="mt-3 p-2.5 bg-cyan-50 rounded-lg border border-cyan-100">
                <p className="text-xs text-gray-700">
                  <span className="text-cyan-700 font-semibold">Zona:</span> {chartData.zona}
                </p>
                <p className="text-xs text-gray-700 mt-0.5">
                  <span className="text-cyan-700 font-semibold">Lag temporal:</span> {chartData.lag_dias} días
                </p>
              </div>
            )}
          </div>

          {/* Botón */}
          <div className="flex flex-col justify-end">
            <button
              onClick={fetchChart}
              disabled={!selectedProducto || loading}
              className="w-full px-4 py-3 bg-agro-600 text-white rounded-lg font-medium hover:bg-agro-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
            >
              {loading ? 'Cargando…' : 'Analizar Clima × Precio'}
            </button>
          </div>
        </div>
      </div>

      {/* Gráfico dual */}
      {loading && (
        <div className="text-center py-12 text-gray-500">Cargando datos…</div>
      )}

      {!loading && !hasSearched && (
        <div className="text-center py-12">
          <CloudRain className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Selecciona un producto y presiona "Analizar"</p>
          <p className="text-gray-400 text-sm mt-1">Si no hay datos climáticos, usa el botón "Importar Clima" primero</p>
        </div>
      )}

      {!loading && hasSearched && chartData && chartData.series?.length > 0 && (
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <h3 className="text-base font-semibold text-gray-900 mb-1">
            {chartData.producto} — {selVar.label} vs Precio
          </h3>
          <p className="text-xs text-gray-500 mb-4">
            Zona: {chartData.zona || 'N/A'} · Lag: {chartData.lag_dias || 0} días · {chartData.series.length} puntos
          </p>
          <ResponsiveContainer width="100%" height={380}>
            <ComposedChart data={chartData.series} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="fecha"
                tick={{ fill: '#6b7280', fontSize: 10 }}
                tickFormatter={(f: string) => { const d = new Date(f); return `${d.getDate()}/${d.getMonth()+1}`; }}
                interval={Math.floor(chartData.series.length / 12)}
              />
              <YAxis
                yAxisId="precio"
                orientation="left"
                tick={{ fill: '#059669', fontSize: 11 }}
                tickFormatter={(v: number) => `$${v >= 1000 ? Math.round(v/1000) + 'k' : v}`}
                label={{ value: 'Precio ($)', angle: -90, position: 'insideLeft', fill: '#059669', fontSize: 11 }}
              />
              <YAxis
                yAxisId="clima"
                orientation="right"
                tick={{ fill: selVar.color, fontSize: 11 }}
                label={{ value: `${selVar.label} (${selVar.unit})`, angle: 90, position: 'insideRight', fill: selVar.color, fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 12px rgb(0 0 0 / 0.1)' }}
                labelStyle={{ color: '#374151', fontWeight: 600 }}
                formatter={(value: any, name: string) => {
                  if (value == null) return ['—', name];
                  if (name === 'Precio') return [`$${Number(value).toLocaleString('es-CL')}`, name];
                  return [`${Number(value).toFixed(1)} ${selVar.unit}`, name];
                }}
              />
              <Legend />
              <Line
                yAxisId="precio"
                type="monotone"
                dataKey="precio"
                name="Precio"
                stroke="#059669"
                strokeWidth={2}
                dot={false}
                connectNulls
              />
              {selectedVariable === 'precipitacion' ? (
                <Bar
                  yAxisId="clima"
                  dataKey="clima"
                  name={selVar.label}
                  fill={selVar.color}
                  opacity={0.4}
                />
              ) : (
                <Line
                  yAxisId="clima"
                  type="monotone"
                  dataKey="clima"
                  name={selVar.label}
                  stroke={selVar.color}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  connectNulls
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {!loading && hasSearched && chartData && (!chartData.series || chartData.series.length === 0) && (
        <div className="text-center py-8 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-600 font-medium">Sin datos para esta combinación</p>
          {!chartData.zona && (
            <p className="text-gray-400 text-sm mt-1">Este producto no tiene zona de producción mapeada</p>
          )}
          <p className="text-gray-400 text-sm mt-1">Asegúrate de haber importado datos climáticos</p>
        </div>
      )}

      {/* Tabla de correlaciones */}
      {!loadingCorr && correlaciones.length > 0 && (
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <h3 className="text-base font-semibold text-gray-900 mb-1">
            Correlaciones Clima × Precio — {selectedProducto}
          </h3>
          <p className="text-xs text-gray-500 mb-4">
            Valores cercanos a +1 o -1 indican fuerte correlación. Cercanos a 0 = sin correlación.
          </p>

          {/* Leyenda */}
          <div className="flex flex-wrap items-center gap-3 mb-4 text-xs text-gray-600">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500 inline-block" /> Positiva fuerte</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-200 inline-block" /> Positiva media</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-200 inline-block" /> Débil</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-200 inline-block" /> Negativa media</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500 inline-block" /> Negativa fuerte</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {correlaciones.map((c: any, i: number) => (
              <div
                key={i}
                className={`p-3 rounded-lg border border-gray-200 ${corrBg(c.correlacion)}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-gray-400">{c.zona}</span>
                    <p className="text-sm font-medium text-gray-800">{varLabel(c.variable)}</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-lg font-bold ${corrColor(c.correlacion)}`}>
                      {c.correlacion > 0 ? '+' : ''}{c.correlacion.toFixed(2)}
                    </span>
                    <p className="text-[10px] text-gray-400">{c.observaciones} obs.</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
