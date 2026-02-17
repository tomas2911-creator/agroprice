import { useState } from 'react';
import {
  LayoutDashboard, TrendingUp, BarChart3, Map, Activity,
  Flame, CalendarDays, GitCompare, Grid3X3, CloudRain,
  Download, Menu, X, Leaf
} from 'lucide-react';

const navItems = [
  { id: 'resumen', label: 'Resumen', icon: LayoutDashboard },
  { id: 'precios', label: 'Precios', icon: BarChart3 },
  { id: 'variaciones', label: 'Variaciones', icon: TrendingUp },
  { id: 'serie-temporal', label: 'Serie Temporal', icon: Activity },
  { id: 'spread', label: 'Spread Mercados', icon: Map },
  { id: 'volatilidad', label: 'Volatilidad', icon: Flame },
  { id: 'estacionalidad', label: 'Estacionalidad', icon: CalendarDays },
  { id: 'correlaciones', label: 'Correlaciones', icon: GitCompare },
  { id: 'heatmap', label: 'Heatmap', icon: Grid3X3 },
  { id: 'clima', label: 'Clima × Precios', icon: CloudRain },
  { id: 'exportar', label: 'Exportar CSV', icon: Download },
];

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
}

export default function Sidebar({ activeView, onViewChange }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Botón mobile */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 bg-agro-600 text-white p-2 rounded-lg shadow-lg"
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Overlay mobile */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 bg-white border-r border-gray-200 
          flex flex-col transition-all duration-300 shadow-lg lg:shadow-none
          ${collapsed ? 'w-16' : 'w-64'} 
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-100">
          <div className="flex-shrink-0 w-8 h-8 bg-agro-600 rounded-lg flex items-center justify-center">
            <Leaf size={18} className="text-white" />
          </div>
          {!collapsed && (
            <div>
              <h1 className="font-bold text-gray-900 text-lg leading-tight">AgroPrice</h1>
              <p className="text-xs text-gray-500">Precios Mayoristas</p>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:block ml-auto text-gray-400 hover:text-gray-600"
          >
            <Menu size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 overflow-y-auto scrollbar-thin">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onViewChange(item.id);
                  setMobileOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors
                  ${isActive
                    ? 'bg-agro-50 text-agro-700 border-r-2 border-agro-600 font-medium'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                title={collapsed ? item.label : undefined}
              >
                <Icon size={18} className={isActive ? 'text-agro-600' : ''} />
                {!collapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        {!collapsed && (
          <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
            Fuente: ODEPA Chile
          </div>
        )}
      </aside>
    </>
  );
}
