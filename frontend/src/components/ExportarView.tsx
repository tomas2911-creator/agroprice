import { useState, useEffect } from 'react';
import { Download } from 'lucide-react';
import { getMercados, getProductos, exportCSV } from '../services/api';

export default function ExportarView() {
  const [mercados, setMercados] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [selectedMercados, setSelectedMercados] = useState<string[]>([]);
  const [selectedProductos, setSelectedProductos] = useState<string[]>([]);
  const [selectedCategorias, setSelectedCategorias] = useState<string[]>([]);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');

  useEffect(() => {
    Promise.all([getMercados(), getProductos()])
      .then(([m, p]) => { setMercados(m); setProductos(p); })
      .catch(console.error);
  }, []);

  const handleExport = () => {
    exportCSV({
      fecha_inicio: fechaInicio || undefined,
      fecha_fin: fechaFin || undefined,
      mercados: selectedMercados.length ? selectedMercados : undefined,
      productos: selectedProductos.length ? selectedProductos : undefined,
      categorias: selectedCategorias.length ? selectedCategorias : undefined,
    });
  };

  const toggleItem = (arr: string[], setArr: (v: string[]) => void, item: string) => {
    setArr(arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item]);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-900">Exportar CSV</h2>
      <p className="text-sm text-gray-500">Descarga los datos filtrados en formato CSV</p>

      <div className="bg-white rounded-xl border border-gray-200 p-5 max-w-2xl">
        {/* Categorías */}
        <div className="mb-4">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Categoría</label>
          <div className="flex gap-2 mt-1">
            {['fruta', 'hortaliza'].map((cat) => (
              <button
                key={cat}
                onClick={() => toggleItem(selectedCategorias, setSelectedCategorias, cat)}
                className={`px-3 py-1.5 rounded-lg text-sm capitalize transition-colors
                  ${selectedCategorias.includes(cat) ? 'bg-agro-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {cat === 'fruta' ? '🍎 Frutas' : '🥬 Hortalizas'}
              </button>
            ))}
          </div>
        </div>

        {/* Mercados */}
        <div className="mb-4">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Mercados {selectedMercados.length > 0 && `(${selectedMercados.length})`}
          </label>
          <div className="flex flex-wrap gap-1.5 mt-1 max-h-24 overflow-y-auto">
            {mercados.map((m) => (
              <button
                key={m.id}
                onClick={() => toggleItem(selectedMercados, setSelectedMercados, m.nombre)}
                className={`px-2.5 py-1 rounded-md text-xs transition-colors
                  ${selectedMercados.includes(m.nombre) ? 'bg-agro-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {m.nombre}
              </button>
            ))}
          </div>
        </div>

        {/* Productos */}
        <div className="mb-4">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Productos {selectedProductos.length > 0 && `(${selectedProductos.length})`}
          </label>
          <div className="flex flex-wrap gap-1.5 mt-1 max-h-32 overflow-y-auto scrollbar-thin">
            {productos
              .filter((p) => !selectedCategorias.length || selectedCategorias.includes(p.categoria))
              .map((p) => (
                <button
                  key={p.id}
                  onClick={() => toggleItem(selectedProductos, setSelectedProductos, p.nombre)}
                  className={`px-2.5 py-1 rounded-md text-xs transition-colors
                    ${selectedProductos.includes(p.nombre) ? 'bg-agro-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {p.nombre}
                </button>
              ))}
          </div>
        </div>

        {/* Fechas */}
        <div className="grid grid-cols-2 gap-3 mb-6">
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
        </div>

        <button
          onClick={handleExport}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-agro-600 text-white 
            rounded-lg font-medium hover:bg-agro-700 transition-colors"
        >
          <Download size={18} />
          Descargar CSV
        </button>
      </div>
    </div>
  );
}
