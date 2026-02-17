import { useState, useEffect } from 'react';
import { getMercados, getProductos, getSubcategorias, getCorrelaciones } from '../services/api';

const corrColor = (v: number) => {
  if (v >= 0.7) return 'bg-green-500 text-white';
  if (v >= 0.4) return 'bg-green-200 text-green-900';
  if (v >= 0.1) return 'bg-green-50 text-green-800';
  if (v >= -0.1) return 'bg-gray-100 text-gray-600';
  if (v >= -0.4) return 'bg-red-50 text-red-800';
  if (v >= -0.7) return 'bg-red-200 text-red-900';
  return 'bg-red-500 text-white';
};

const corrLabel = (v: number) => {
  const abs = Math.abs(v);
  if (abs >= 0.7) return 'Fuerte';
  if (abs >= 0.4) return 'Moderada';
  if (abs >= 0.1) return 'Débil';
  return 'Nula';
};

export default function CorrelacionesView() {
  const [mercados, setMercados] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [selectedProducto, setSelectedProducto] = useState('');
  const [selectedMercado, setSelectedMercado] = useState('');
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

  const fetchData = () => {
    if (!selectedProducto || !selectedMercado) return;
    setLoading(true);
    setHasSearched(true);
    getCorrelaciones({
      producto: selectedProducto,
      mercado: selectedMercado,
      topN: 30,
      variedad: selVariedad || undefined,
      calidad: selCalidad || undefined,
      unidad: selUnidad || undefined,
    })
      .then(setData)
      .catch((err) => { console.error(err); setData([]); })
      .finally(() => setLoading(false));
  };

  const filteredProductos = productos.filter((p) =>
    !searchProd || p.nombre.toLowerCase().includes(searchProd.toLowerCase())
  );

  // Separar por categoría
  const frutas = data.filter((d) => d.categoria === 'fruta');
  const hortalizas = data.filter((d) => d.categoria === 'hortaliza');

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-900">Correlaciones de Precio</h2>
      <p className="text-sm text-gray-500">Productos que se mueven juntos en precio</p>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* Producto */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Producto base</label>
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

          {/* Sub-filtros + Mercado */}
          <div className="space-y-2">
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Mercado</label>
              <select
                value={selectedMercado}
                onChange={(e) => setSelectedMercado(e.target.value)}
                className="w-full mt-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
              >
                <option value="">Seleccionar mercado</option>
                {mercados.map((m) => (
                  <option key={m.id} value={m.nombre}>{m.nombre}</option>
                ))}
              </select>
            </div>
            {selectedProducto && (subcats.variedades.length > 1 || subcats.calidades.length > 1 || subcats.unidades.length > 1) && (
              <div className="space-y-1.5">
                {subcats.variedades.length > 1 && (
                  <select value={selVariedad} onChange={(e) => setSelVariedad(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm">
                    <option value="">Todas las variedades</option>
                    {subcats.variedades.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                )}
                {subcats.calidades.length > 1 && (
                  <select value={selCalidad} onChange={(e) => setSelCalidad(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm">
                    <option value="">Todas las calidades</option>
                    {subcats.calidades.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                )}
                {subcats.unidades.length > 1 && (
                  <select value={selUnidad} onChange={(e) => setSelUnidad(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm">
                    <option value="">Todas las unidades</option>
                    {subcats.unidades.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                )}
              </div>
            )}
          </div>

          {/* Botón */}
          <div className="flex items-end">
            <button
              onClick={fetchData}
              disabled={!selectedProducto || !selectedMercado || loading}
              className="w-full px-4 py-2.5 bg-agro-600 text-white rounded-lg font-medium text-sm
                hover:bg-agro-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Calculando...' : 'Buscar Correlaciones'}
            </button>
          </div>
        </div>

        {/* Estados vacíos */}
        {!loading && !hasSearched && (
          <p className="text-center text-gray-400 py-8">Selecciona un producto, mercado y presiona "Buscar Correlaciones"</p>
        )}
        {!loading && hasSearched && data.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500 font-medium">Sin resultados para esta combinación</p>
            <p className="text-gray-400 text-sm mt-1">Prueba quitando filtros o seleccionando otro mercado</p>
          </div>
        )}

        {/* Resultados — Grid visual por categoría */}
        {data.length > 0 && (
          <div className="mt-6 space-y-6">
            <h3 className="font-semibold text-gray-900">
              Correlación con <span className="text-agro-600">{selectedProducto}</span> en {selectedMercado}
            </h3>

            {/* Leyenda */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-gray-500">Escala:</span>
              <span className="px-2 py-0.5 bg-red-500 text-white rounded">-1.0</span>
              <span className="px-2 py-0.5 bg-red-200 rounded">-0.7</span>
              <span className="px-2 py-0.5 bg-red-50 rounded">-0.4</span>
              <span className="px-2 py-0.5 bg-gray-100 rounded">0</span>
              <span className="px-2 py-0.5 bg-green-50 rounded">+0.4</span>
              <span className="px-2 py-0.5 bg-green-200 rounded">+0.7</span>
              <span className="px-2 py-0.5 bg-green-500 text-white rounded">+1.0</span>
            </div>

            {/* Frutas */}
            {frutas.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-orange-600 mb-2">🍎 Frutas ({frutas.length})</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                  {frutas.map((d, i) => (
                    <div key={i} className={`rounded-lg px-3 py-2.5 text-center ${corrColor(d.correlacion)}`}>
                      <p className="font-medium text-sm truncate" title={d.producto}>{d.producto}</p>
                      <p className="text-lg font-bold">{d.correlacion > 0 ? '+' : ''}{d.correlacion}</p>
                      <p className="text-[10px] opacity-75">{corrLabel(d.correlacion)} · {d.observaciones} obs</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Hortalizas */}
            {hortalizas.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-green-600 mb-2">🥬 Hortalizas ({hortalizas.length})</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                  {hortalizas.map((d, i) => (
                    <div key={i} className={`rounded-lg px-3 py-2.5 text-center ${corrColor(d.correlacion)}`}>
                      <p className="font-medium text-sm truncate" title={d.producto}>{d.producto}</p>
                      <p className="text-lg font-bold">{d.correlacion > 0 ? '+' : ''}{d.correlacion}</p>
                      <p className="text-[10px] opacity-75">{corrLabel(d.correlacion)} · {d.observaciones} obs</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tabla detallada */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">Producto</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">Cat.</th>
                    <th className="px-4 py-2 text-center font-medium text-gray-500">Correlación</th>
                    <th className="px-4 py-2 text-center font-medium text-gray-500">Fuerza</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-500">Obs.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.map((d, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-900">{d.producto}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium
                          ${d.categoria === 'fruta' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                          {d.categoria}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded font-mono font-bold text-xs ${corrColor(d.correlacion)}`}>
                          {d.correlacion > 0 ? '+' : ''}{d.correlacion}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-center text-xs text-gray-600">{corrLabel(d.correlacion)}</td>
                      <td className="px-4 py-2 text-right text-gray-500">{d.observaciones}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
