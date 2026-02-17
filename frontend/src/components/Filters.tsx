import { useState, useEffect } from 'react';
import { Filter, X } from 'lucide-react';
import { getMercados, getProductos } from '../services/api';

interface FiltersProps {
  onFilterChange: (filters: FilterState) => void;
  showDias?: boolean;
}

export interface FilterState {
  mercados: string[];
  productos: string[];
  categorias: string[];
  fechaInicio: string;
  fechaFin: string;
  dias: number;
}

export default function Filters({ onFilterChange, showDias = false }: FiltersProps) {
  const [mercados, setMercados] = useState<{ id: number; nombre: string }[]>([]);
  const [productos, setProductos] = useState<{ id: number; nombre: string; categoria: string }[]>([]);
  const [filters, setFilters] = useState<FilterState>({
    mercados: [],
    productos: [],
    categorias: [],
    fechaInicio: '',
    fechaFin: '',
    dias: 7,
  });
  const [showPanel, setShowPanel] = useState(false);

  useEffect(() => {
    Promise.all([getMercados(), getProductos()])
      .then(([m, p]) => {
        setMercados(m);
        setProductos(p);
      })
      .catch(console.error);
  }, []);

  const updateFilter = (key: keyof FilterState, value: unknown) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const toggleArrayItem = (key: 'mercados' | 'productos' | 'categorias', item: string) => {
    const arr = filters[key];
    const newArr = arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
    updateFilter(key, newArr);
  };

  const clearFilters = () => {
    const empty: FilterState = { mercados: [], productos: [], categorias: [], fechaInicio: '', fechaFin: '', dias: 7 };
    setFilters(empty);
    onFilterChange(empty);
  };

  const activeCount = filters.mercados.length + filters.productos.length + filters.categorias.length
    + (filters.fechaInicio ? 1 : 0) + (filters.fechaFin ? 1 : 0);

  return (
    <div className="relative">
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg 
          hover:bg-gray-50 text-sm font-medium text-gray-700 shadow-sm"
      >
        <Filter size={16} />
        Filtros
        {activeCount > 0 && (
          <span className="bg-agro-600 text-white text-xs px-1.5 py-0.5 rounded-full">{activeCount}</span>
        )}
      </button>

      {showPanel && (
        <div className="absolute top-12 left-0 z-30 w-[480px] bg-white rounded-xl shadow-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Filtros</h3>
            <div className="flex gap-2">
              {activeCount > 0 && (
                <button onClick={clearFilters} className="text-xs text-red-500 hover:text-red-700">
                  Limpiar todo
                </button>
              )}
              <button onClick={() => setShowPanel(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Categorías */}
          <div className="mb-4">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Categoría</label>
            <div className="flex gap-2 mt-1">
              {['fruta', 'hortaliza'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => toggleArrayItem('categorias', cat)}
                  className={`px-3 py-1.5 rounded-lg text-sm capitalize transition-colors
                    ${filters.categorias.includes(cat)
                      ? 'bg-agro-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                >
                  {cat === 'fruta' ? '🍎 Frutas' : '🥬 Hortalizas'}
                </button>
              ))}
            </div>
          </div>

          {/* Mercados */}
          <div className="mb-4">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Mercados</label>
            <div className="flex flex-wrap gap-1.5 mt-1 max-h-24 overflow-y-auto">
              {mercados.map((m) => (
                <button
                  key={m.id}
                  onClick={() => toggleArrayItem('mercados', m.nombre)}
                  className={`px-2.5 py-1 rounded-md text-xs transition-colors
                    ${filters.mercados.includes(m.nombre)
                      ? 'bg-agro-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                >
                  {m.nombre}
                </button>
              ))}
            </div>
          </div>

          {/* Productos */}
          <div className="mb-4">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Productos</label>
            <div className="flex flex-wrap gap-1.5 mt-1 max-h-32 overflow-y-auto scrollbar-thin">
              {productos
                .filter((p) => !filters.categorias.length || filters.categorias.includes(p.categoria))
                .map((p) => (
                  <button
                    key={p.id}
                    onClick={() => toggleArrayItem('productos', p.nombre)}
                    className={`px-2.5 py-1 rounded-md text-xs transition-colors
                      ${filters.productos.includes(p.nombre)
                        ? 'bg-agro-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                  >
                    {p.nombre}
                  </button>
                ))}
            </div>
          </div>

          {/* Fechas */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Desde</label>
              <input
                type="date"
                value={filters.fechaInicio}
                onChange={(e) => updateFilter('fechaInicio', e.target.value)}
                className="w-full mt-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Hasta</label>
              <input
                type="date"
                value={filters.fechaFin}
                onChange={(e) => updateFilter('fechaFin', e.target.value)}
                className="w-full mt-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
              />
            </div>
          </div>

          {/* Días para comparación */}
          {showDias && (
            <div className="mb-2">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Comparar con hace X días
              </label>
              <div className="flex gap-2 mt-1">
                {[1, 7, 14, 30, 90].map((d) => (
                  <button
                    key={d}
                    onClick={() => updateFilter('dias', d)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors
                      ${filters.dias === d
                        ? 'bg-agro-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                  >
                    {d}d
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
