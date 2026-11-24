import { useEffect } from 'react';
import {
  Activity,
  BarChart3,
  FileSearch,
  Sliders,
} from 'lucide-react';
import { useOSBridge } from './bridge/useOSBridge';
import { KpiRibbon } from './components/KpiRibbon';
import { TopBar } from './components/TopBar';
import { AssumptionsTab } from './components/tabs/AssumptionsTab';
import { AuditTab } from './components/tabs/AuditTab';
import { CashflowTab } from './components/tabs/CashflowTab';
import { RiskTab } from './components/tabs/RiskTab';
import { useFeasoStore, type ActiveTab } from './store/useFeasoStore';

const TABS: {
  id: ActiveTab;
  label: string;
  icon: typeof Sliders;
}[] = [
  { id: 'assumptions', label: 'Assumptions & Stages', icon: Sliders },
  { id: 'cashflow', label: 'Monthly Cashflow', icon: BarChart3 },
  { id: 'risk', label: 'Risk & Sensitivity', icon: Activity },
  { id: 'audit', label: 'Glass-Box Audit', icon: FileSearch },
];

export default function App() {
  useOSBridge();

  const activeTab = useFeasoStore((s) => s.activeTab);
  const setActiveTab = useFeasoStore((s) => s.setActiveTab);
  const monteCarloResult = useFeasoStore((s) => s.monteCarloResult);
  const monteCarloRunning = useFeasoStore((s) => s.monteCarloRunning);
  const runMonteCarloNow = useFeasoStore((s) => s.runMonteCarloNow);

  // Trigger initial background 10,000-run Monte Carlo so Top KPI P50 RLV & PROJECT_PATCH populate promptly
  useEffect(() => {
    if (!monteCarloResult && !monteCarloRunning) {
      const timer = window.setTimeout(() => {
        void runMonteCarloNow();
      }, 60);
      return () => window.clearTimeout(timer);
    }
  }, [monteCarloResult, monteCarloRunning, runMonteCarloNow]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#0e1217] text-[#e6edf3]">
      <TopBar />
      <KpiRibbon />

      {/* Workstation Navigation Tab Bar */}
      <nav
        aria-label="Feasibility Workstation Views"
        className="flex items-center gap-1 border-b border-[rgba(214,226,240,0.1)] bg-[#10141a] px-3 pt-1 shrink-0 overflow-x-auto"
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              data-testid={`tab-${tab.id}`}
              aria-current={active ? 'page' : undefined}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
                active
                  ? 'border-[#3daee9] text-[#e6edf3] bg-[#151a22]/80 rounded-t-[5px]'
                  : 'border-transparent text-[#93a1b2] hover:text-[#e6edf3] hover:bg-[#151a22]/40 rounded-t-[5px]'
              }`}
            >
              <Icon
                className={`h-3.5 w-3.5 ${
                  active ? 'text-[#3daee9]' : 'text-[#667587]'
                }`}
              />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Main Scrollable Workspace */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden bg-[#0e1217]">
        {activeTab === 'assumptions' && <AssumptionsTab />}
        {activeTab === 'cashflow' && <CashflowTab />}
        {activeTab === 'risk' && <RiskTab />}
        {activeTab === 'audit' && <AuditTab />}
      </main>
    </div>
  );
}
