import { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getMercados, getProductos, getSubcategorias, getSerieTemporal } from '../services/api';

const COLORS = [
  '#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316',
  '#10b981', '#6366f1', '#d946ef', '#14b8a6', '#e11d48', '#84cc16', '#0ea5e9', '#a855f7',
];

type Agregacion = 'diario' | 'semanal' | 'mensual';

export default function SerieTemporalView() {
  const [mercados, setMercados] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [selectedProducto, setSelectedProducto] = useState('');
  const [selectedMercados, setSelectedMercados] = useState<string[]>([]);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [agregacion, setAgregacion] = useState<Agregacion>('diario');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchProd, setSearchProd] = useState('');
  const [subcats, setSubcats] = useState<{variedades: string[], calidades: string[], unidades: string[]}>({variedades: [], calidades: [], unidades: []});
  const [selVariedad, setSelVariedad] = useState('');
  const [selCalidad, setSelCalidad] = useState('');
  const [selUnidad, setSelUnidad] = useState('');

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

  // Auto-sugerir agregación según rango de fechas
  useEffect(() => {
    if (fechaInicio && fechaFin) {
      const dias = Math.ceil((new Date(fechaFin).getTime() - new Date(fechaInicio).getTime()) / (1000 * 60 * 60 * 24));
      if (dias > 180) setAgregacion('mensual');
      else if (dias > 60) setAgregacion('semanal');
      else setAgregacion('diario');
    }
  }, [fechaInicio, fechaFin]);

  const fetchSerie = () => {
    if (!selectedProducto) return;
    setLoading(true);
    setHasSearched(true);
    getSerieTemporal({
      producto: selectedProducto,
      mercados: selectedMercados.length ? selectedMercados : undefined,
      fecha_inicio: fechaInicio || undefined,
      fecha_fin: fechaFin || undefined,
      variedad: selVariedad || undefined,
      calidad: selCalidad || undefined,
      unidad: selUnidad || undefined,
      agregacion,
    })
      .then(setData)
      .catch((err) => { console.error(err); setData([]); })
      .finally(() => setLoading(false));
  };

  // Obtener calidades únicas en los datos
  const calidadesInData = useMemo(() => [...new Set(data.map((d) => d.calidad))].sort(), [data]);
  const mercadosInData = useMemo(() => [...new Set(data.map((d) => d.mercado))], [data]);
  const multipleCalidades = calidadesInData.length > 1;
  const multipleMercados = mercadosInData.length > 1;

  // Generar series (keys) para el gráfico
  const seriesKeys = useMemo(() => {
    const keys: { key: string; label: string }[] = [];
    if (multipleMercados && multipleCalidades) {
      // Múltiples mercados y calidades: "Mercado — Calidad"
      mercadosInData.forEach((m) => {
        calidadesInData.forEach((c) => {
          const exists = data.some((d) => d.mercado === m && d.calidad === c);
          if (exists) keys.push({ key: `${m} — ${c}`, label: `${m} — ${c}` });
        });
      });
    } else if (multipleCalidades) {
      // Un mercado, múltiples calidades: línea por calidad
      calidadesInData.forEach((c) => {
        keys.push({ key: c, label: c });
      });
    } else if (multipleMercados) {
      // Múltiples mercados, una calidad: línea por mercado
      mercadosInData.forEach((m) => {
        keys.push({ key: m, label: m });
      });
    } else if (mercadosInData.length === 1) {
      // Un solo mercado, una calidad
      keys.push({ key: mercadosInData[0], label: mercadosInData[0] });
    }
    return keys;
  }, [data, mercadosInData, calidadesInData, multipleMercados, multipleCalidades]);

  // Transformar datos para Recharts
  const chartData = useMemo(() => {
    const byDate: Record<string, any> = {};
    data.forEach((d) => {
      if (!byDate[d.fecha]) byDate[d.fecha] = { fecha: d.fecha };
      let key: string;
      if (multipleMercados && multipleCalidades) {
        key = `${d.mercado} — ${d.calidad}`;
      } else if (multipleCalidades) {
        key = d.calidad;
      } else {
        key = d.mercado;
      }
      byDate[d.fecha][key] = d.precio_promedio;
    });
    return Object.values(byDate).sort((a: any, b: any) => a.fecha.localeCompare(b.fecha));
  }, [data, multipleMercados, multipleCalidades]);

  const filteredProductos = productos.filter((p) =>
    !searchProd || p.nombre.toLowerCase().includes(searchProd.toLowerCase())
  );

  const agregLabel = agregacion === 'mensual' ? 'Promedio Mensual' : agregacion === 'semanal' ? 'Promedio Semanal' : 'Diario';

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-900">Serie Temporal</h2>

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

          {/* Fechas + Agregación */}
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
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Agregación</label>
              <div className="flex gap-1 mt-1">
                {(['diario', 'semanal', 'mensual'] as Agregacion[]).map((a) => (
                  <button key={a} onClick={() => setAgregacion(a)}
                    className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-lg border transition-colors
                      ${agregacion === a
                        ? 'bg-agro-600 text-white border-agro-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                  >
                    {a === 'diario' ? 'Diario' : a === 'semanal' ? 'Semanal' : 'Mensual'}
                  </button>
                ))}
              </div>
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
            <div className="flex items-baseline justify-between mb-3">
              <h3 className="font-semibold text-gray-900">
                {selectedProducto} — Evolución de Precio Promedio
              </h3>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
                {agregLabel} · {data.length} registros · {seriesKeys.length} {seriesKeys.length === 1 ? 'serie' : 'series'}
              </span>
            </div>
            <ResponsiveContainer width="100%" height={420}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="fecha" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${Number(v).toLocaleString()}`} />
                <Tooltip
                  formatter={(value: number, name: string) => [`$${Number(value).toLocaleString()}`, name]}
                  labelFormatter={(label) => {
                    if (agregacion === 'semanal') return `Semana del ${label}`;
                    if (agregacion === 'mensual') return `Mes de ${label}`;
                    return `Fecha: ${label}`;
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {seriesKeys.map((s, i) => (
                  <Line key={s.key} type="monotone" dataKey={s.key} name={s.label}
                    stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false}
                    connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>

            {/* Leyenda de calidades si hay múltiples */}
            {multipleCalidades && !selCalidad && (
              <p className="text-xs text-gray-400 mt-2 text-center">
                Se muestran líneas separadas por calidad. Usa el filtro "Todas las calidades" para ver solo una.
              </p>
            )}
          </div>
        )}

        {!loading && !hasSearched && (
          <p className="text-center text-gray-400 py-8">Selecciona un producto y presiona "Ver Serie"</p>
        )}
        {data.length === 0 && !loading && hasSearched && (
          <div className="text-center py-8">
            <p className="text-gray-500 font-medium">Sin resultados para esta combinación</p>
            <p className="text-gray-400 text-sm mt-1">Prueba quitando filtros de variedad/calidad/unidad o selecciona otros mercados</p>
          </div>
        )}
      </div>
    </div>
  );
}
