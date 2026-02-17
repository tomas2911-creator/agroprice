import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import ResumenView from './components/ResumenView';
import PreciosView from './components/PreciosView';
import VariacionesView from './components/VariacionesView';
import SerieTemporalView from './components/SerieTemporalView';
import SpreadView from './components/SpreadView';
import VolatilidadView from './components/VolatilidadView';
import EstacionalidadView from './components/EstacionalidadView';
import CorrelacionesView from './components/CorrelacionesView';
import HeatmapView from './components/HeatmapView';
import CanastaView from './components/CanastaView';
import ExportarView from './components/ExportarView';
import ImportarView from './components/ImportarView';

const views: Record<string, React.FC> = {
  'resumen': ResumenView,
  'precios': PreciosView,
  'variaciones': VariacionesView,
  'serie-temporal': SerieTemporalView,
  'spread': SpreadView,
  'volatilidad': VolatilidadView,
  'estacionalidad': EstacionalidadView,
  'correlaciones': CorrelacionesView,
  'heatmap': HeatmapView,
  'canasta': CanastaView,
  'exportar': ExportarView,
  'importar': ImportarView,
};

function App() {
  const [activeView, setActiveView] = useState('resumen');
  const ActiveComponent = views[activeView] || ResumenView;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <ActiveComponent />
        </div>
      </main>
    </div>
  );
}

export default App;
