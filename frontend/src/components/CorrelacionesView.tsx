import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getMercados, getProductos, getCorrelaciones } from '../services/api';

export default function CorrelacionesView() {
  const [mercados, setMercados] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [selectedProducto, setSelectedProducto] = useState('');
  const [selectedMercado, setSelectedMercado] = useState('');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchProd, setSearchProd] = useState('');

  useEffect(() => {
    Promise.all([getMercados(), getProductos()])
      .then(([m, p]) => { setMercados(m); setProductos(p); })
      .catch(console.error);
  }, []);

  const fetchData = () => {
    if (!selectedProducto || !selectedMercado) return;
    setLoading(true);
    getCorrelaciones(selectedProducto, selectedMercado, 20)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const filteredProductos = productos.filter((p) =>
    !searchProd || p.nombre.toLowerCase().includes(searchProd.toLowerCase())
  );

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
                  onClick={() => { setSelectedProducto(p.nombre); setSearchProd(p.nombre); }}
                  className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50
                    ${selectedProducto === p.nombre ? 'bg-agro-50 text-agro-700 font-medium' : 'text-gray-700'}`}
                >
                  {p.nombre}
                </button>
              ))}
            </div>
          </div>

          {/* Mercado */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Mercado</label>
            <select
              value={selectedMercado}
              onChange={(e) => setSelectedMercado(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
            >
              <option value="">Seleccionar mercado</option>
              {mercados.map((m) => (
                <option key={m.id} value={m.nombre}>{m.nombre}</option>
              ))}
            </select>
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

        {/* Gráfico */}
        {data.length > 0 && (
          <div className="mt-6">
            <h3 className="font-semibold text-gray-900 mb-3">
              Correlación con {selectedProducto} en {selectedMercado}
            </h3>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={data} layout="vertical" margin={{ left: 120 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" domain={[-1, 1]} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="producto" tick={{ fontSize: 11 }} width={110} />
                <Tooltip formatter={(value: number) => [value.toFixed(4), 'Correlación']} />
                <Bar dataKey="correlacion" radius={[0, 4, 4, 0]}>
                  {data.map((d: any, i: number) => (
                    <Cell key={i} fill={d.correlacion >= 0 ? '#22c55e' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            <div className="mt-4 text-xs text-gray-500 space-y-1">
              <p><strong>+1.0:</strong> Correlación positiva perfecta (se mueven igual)</p>
              <p><strong>0:</strong> Sin correlación</p>
              <p><strong>-1.0:</strong> Correlación negativa perfecta (se mueven opuesto)</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
