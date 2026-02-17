import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Plus, Trash2 } from 'lucide-react';
import { getMercados, getProductos, getCanasta } from '../services/api';

interface CanastaItem {
  producto: string;
  mercado: string;
}

export default function CanastaView() {
  const [mercados, setMercados] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [items, setItems] = useState<CanastaItem[]>([]);
  const [newProducto, setNewProducto] = useState('');
  const [newMercado, setNewMercado] = useState('');
  const [nombre, setNombre] = useState('Mi Canasta');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchProd, setSearchProd] = useState('');

  useEffect(() => {
    Promise.all([getMercados(), getProductos()])
      .then(([m, p]) => { setMercados(m); setProductos(p); })
      .catch(console.error);
  }, []);

  const addItem = () => {
    if (newProducto && newMercado) {
      setItems([...items, { producto: newProducto, mercado: newMercado }]);
      setNewProducto('');
      setNewMercado('');
      setSearchProd('');
    }
  };

  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const calcular = () => {
    if (items.length === 0) return;
    setLoading(true);
    getCanasta({ nombre, items })
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const filteredProductos = productos.filter((p) =>
    !searchProd || p.nombre.toLowerCase().includes(searchProd.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-900">Índice de Canasta Personalizable</h2>
      <p className="text-sm text-gray-500">Crea tu propia canasta de productos y visualiza la evolución del costo total</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuración */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="mb-4">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Nombre</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>

          {/* Agregar item */}
          <div className="space-y-2 mb-4">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Agregar producto</label>
            <input
              type="text"
              placeholder="Buscar producto..."
              value={searchProd}
              onChange={(e) => setSearchProd(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
            <div className="max-h-24 overflow-y-auto border border-gray-100 rounded-lg scrollbar-thin">
              {filteredProductos.slice(0, 20).map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setNewProducto(p.nombre); setSearchProd(p.nombre); }}
                  className={`w-full text-left px-3 py-1 text-sm hover:bg-gray-50
                    ${newProducto === p.nombre ? 'bg-agro-50 text-agro-700 font-medium' : ''}`}
                >
                  {p.nombre}
                </button>
              ))}
            </div>
            <select
              value={newMercado}
              onChange={(e) => setNewMercado(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            >
              <option value="">Seleccionar mercado</option>
              {mercados.map((m) => (
                <option key={m.id} value={m.nombre}>{m.nombre}</option>
              ))}
            </select>
            <button
              onClick={addItem}
              disabled={!newProducto || !newMercado}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 
                rounded-lg text-sm hover:bg-gray-200 disabled:opacity-50"
            >
              <Plus size={16} /> Agregar
            </button>
          </div>

          {/* Items actuales */}
          <div className="space-y-2 mb-4">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Canasta ({items.length} items)
            </label>
            {items.length === 0 ? (
              <p className="text-xs text-gray-400">Agrega productos a tu canasta</p>
            ) : (
              items.map((item, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
                  <div className="text-sm">
                    <p className="font-medium text-gray-900">{item.producto}</p>
                    <p className="text-xs text-gray-500">{item.mercado}</p>
                  </div>
                  <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>

          <button
            onClick={calcular}
            disabled={items.length === 0 || loading}
            className="w-full px-4 py-2.5 bg-agro-600 text-white rounded-lg font-medium text-sm
              hover:bg-agro-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Calculando...' : 'Calcular Canasta'}
          </button>
        </div>

        {/* Gráfico */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          {data.length > 0 ? (
            <>
              <h3 className="font-semibold text-gray-900 mb-3">
                Evolución del costo total — {nombre}
              </h3>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="fecha" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `$${v.toLocaleString()}`} />
                  <Tooltip
                    formatter={(value: number) => [`$${value?.toLocaleString()}`, 'Total canasta']}
                    labelFormatter={(label: string) => `Fecha: ${label}`}
                  />
                  <Line type="monotone" dataKey="total_canasta" stroke="#22c55e"
                    strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </>
          ) : (
            <div className="flex items-center justify-center h-96 text-gray-400">
              <p>Configura tu canasta y presiona "Calcular"</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
