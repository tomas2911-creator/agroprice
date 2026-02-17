import { useState, useEffect } from 'react';
import { Database, Play, RefreshCw, CheckCircle, XCircle, Clock } from 'lucide-react';
import { importarFecha, importarHistorico, getImportaciones } from '../services/api';

export default function ImportarView() {
  const [importaciones, setImportaciones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Importación individual
  const [fecha, setFecha] = useState('');

  // Importación histórica
  const [fechaInicio, setFechaInicio] = useState('2023-01-01');
  const [fechaFin, setFechaFin] = useState('');
  const [forzar, setForzar] = useState(false);

  const fetchImportaciones = () => {
    getImportaciones()
      .then(setImportaciones)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchImportaciones(); }, []);

  const handleImportarFecha = async () => {
    if (!fecha) return;
    setImporting(true);
    setResult(null);
    try {
      const res = await importarFecha(fecha, forzar);
      setResult(res);
      fetchImportaciones();
    } catch (e: any) {
      setResult({ estado: 'error', detalle: e.message });
    }
    setImporting(false);
  };

  const handleImportarHistorico = async () => {
    if (!fechaInicio) return;
    setImporting(true);
    setResult(null);
    try {
      const res = await importarHistorico(fechaInicio, fechaFin || undefined, forzar);
      setResult(res);
      fetchImportaciones();
    } catch (e: any) {
      setResult({ estado: 'error', detalle: e.message });
    }
    setImporting(false);
  };

  const estadoIcon = (estado: string) => {
    switch (estado) {
      case 'ok': return <CheckCircle size={14} className="text-green-500" />;
      case 'error': return <XCircle size={14} className="text-red-500" />;
      case 'no_disponible': return <Clock size={14} className="text-gray-400" />;
      default: return <Clock size={14} className="text-yellow-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Importación de Boletines</h2>
        <p className="text-sm text-gray-500">Descarga y procesa boletines de ODEPA</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Importar fecha específica */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Database size={20} className="text-agro-600" />
            <h3 className="font-semibold text-gray-900">Importar fecha específica</h3>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Fecha</label>
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <button
              onClick={handleImportarFecha}
              disabled={!fecha || importing}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-agro-600 text-white 
                rounded-lg font-medium text-sm hover:bg-agro-700 disabled:opacity-50"
            >
              {importing ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} />}
              {importing ? 'Importando...' : 'Importar'}
            </button>
          </div>
        </div>

        {/* Importar rango histórico */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Database size={20} className="text-blue-600" />
            <h3 className="font-semibold text-gray-900">Importar rango histórico</h3>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Desde</label>
                <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Hasta</label>
                <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)}
                  placeholder="Hoy"
                  className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={forzar} onChange={(e) => setForzar(e.target.checked)}
                className="rounded text-agro-600" />
              Forzar reimportación (sobrescribir existentes)
            </label>
            <button
              onClick={handleImportarHistorico}
              disabled={!fechaInicio || importing}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white 
                rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {importing ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} />}
              {importing ? 'Importando histórico...' : 'Importar Histórico'}
            </button>
          </div>
        </div>
      </div>

      {/* Resultado */}
      {result && (
        <div className={`rounded-xl border p-4 ${
          result.estado === 'ok' || result.importados_ok ? 'bg-green-50 border-green-200' :
          result.estado === 'error' ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'
        }`}>
          <h4 className="font-semibold mb-2">Resultado</h4>
          <pre className="text-sm overflow-x-auto">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}

      {/* Log de importaciones */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Log de importaciones</h3>
          <button onClick={fetchImportaciones} className="text-gray-400 hover:text-gray-600">
            <RefreshCw size={16} />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Estado</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Fecha Boletín</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Importado</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Registros</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-200 rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : importaciones.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    Sin importaciones aún. Usa los controles de arriba para importar boletines.
                  </td>
                </tr>
              ) : (
                importaciones.map((imp, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-1.5">
                        {estadoIcon(imp.estado)}
                        <span className="text-xs font-medium capitalize">{imp.estado}</span>
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-medium text-gray-900">{imp.fecha_boletin}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">
                      {imp.fecha_importacion ? new Date(imp.fecha_importacion).toLocaleString('es-CL') : '-'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono">{imp.registros}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">{imp.detalle || '-'}</td>
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
