import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  Minus,
  Plus,
  RotateCcw,
  Search,
} from 'lucide-react';
import {
  AVAILABLE_DOCK_BAYS,
  DemoMode,
  INITIAL_TRAILERS,
  TrailerRecord,
  TrailerStatus,
} from '../data/demoData';

const STATUS_FILTERS: Array<'All' | TrailerStatus> = ['All', 'At Dock', 'Inbound', 'Alert'];

const DEMO_MODES: Array<{ id: DemoMode; label: string }> = [
  { id: 'dispatch', label: 'Dock Dispatch' },
  { id: 'thermal', label: 'Thermal Audit' },
  { id: 'gate', label: 'Gate Queue' },
];

function StatusLabel({ status }: { status: TrailerStatus }) {
  if (status === 'Alert') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 whitespace-nowrap">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" aria-hidden="true" />
        <span>Temp Drift</span>
      </span>
    );
  }
  if (status === 'At Dock') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-900 whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5 text-blue-800 shrink-0" aria-hidden="true" />
        <span>At Dock</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 whitespace-nowrap">
      <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" aria-hidden="true" />
      <span>Inbound</span>
    </span>
  );
}

export function InteractiveDemoWorkbench() {
  const [trailers, setTrailers] = useState<TrailerRecord[]>(INITIAL_TRAILERS);
  const [mode, setMode] = useState<DemoMode>('dispatch');
  const [statusFilter, setStatusFilter] = useState<'All' | TrailerStatus>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string>(INITIAL_TRAILERS[1].id);
  const [actionFeedback, setActionFeedback] = useState<string>('');

  const filteredTrailers = useMemo(() => {
    return trailers.filter((item) => {
      const matchesStatus = statusFilter === 'All' || item.status === statusFilter;
      const q = searchQuery.trim().toLowerCase();
      const matchesQuery =
        q === '' ||
        item.id.toLowerCase().includes(q) ||
        item.carrier.toLowerCase().includes(q) ||
        item.cargo.toLowerCase().includes(q);
      return matchesStatus && matchesQuery;
    });
  }, [trailers, statusFilter, searchQuery]);

  const selectedTrailer = useMemo(() => {
    return trailers.find((t) => t.id === selectedId) || trailers[0];
  }, [trailers, selectedId]);

  const occupiedBays = useMemo(() => {
    return new Set(trailers.map((t) => t.dockBay).filter(Boolean) as string[]);
  }, [trailers]);

  const handleAssignBay = (trailerId: string, bay: string) => {
    setTrailers((prev) =>
      prev.map((item) => {
        if (item.id !== trailerId) return item;
        const nextStatus: TrailerStatus =
          Math.abs(item.currentTempC - item.targetTempC) > 1.5 ? 'Alert' : 'At Dock';
        return {
          ...item,
          dockBay: bay === 'Unassigned' ? null : bay,
          etaOrTime: bay === 'Unassigned' ? 'Staged Yard' : 'Docked Just Now',
          status: bay === 'Unassigned' ? 'Inbound' : nextStatus,
        };
      })
    );
    setActionFeedback(
      bay === 'Unassigned'
        ? `Moved ${trailerId} back to yard staging.`
        : `Assigned ${trailerId} to ${bay}. Carrier SMS alert queued.`
    );
  };

  const handleAdjustSetpoint = (trailerId: string, delta: number) => {
    setTrailers((prev) =>
      prev.map((item) => {
        if (item.id !== trailerId) return item;
        const updatedTarget = Number((item.targetTempC + delta).toFixed(1));
        const withinTolerance = Math.abs(item.currentTempC - updatedTarget) <= 1.5;
        const nextStatus: TrailerStatus = withinTolerance
          ? item.dockBay
            ? 'At Dock'
            : 'Inbound'
          : 'Alert';
        return {
          ...item,
          targetTempC: updatedTarget,
          status: nextStatus,
        };
      })
    );
    setActionFeedback(`Updated setpoint for ${trailerId}.`);
  };

  const handleStabilizeTemp = (trailerId: string) => {
    setTrailers((prev) =>
      prev.map((item) => {
        if (item.id !== trailerId) return item;
        return {
          ...item,
          currentTempC: item.targetTempC,
          status: item.dockBay ? 'At Dock' : 'Inbound',
        };
      })
    );
    setActionFeedback(`Pre-cool cycle verified for ${trailerId}. Thermal alert cleared.`);
  };

  const handleResetDemo = () => {
    setTrailers(INITIAL_TRAILERS);
    setStatusFilter('All');
    setSearchQuery('');
    setSelectedId(INITIAL_TRAILERS[1].id);
    setActionFeedback('Demo board reset to initial shift state.');
  };

  const handleExportCsv = () => {
    const header = [
      'Trailer ID',
      'Carrier',
      'Cargo',
      'Dock Bay',
      'Schedule',
      'Current Temp (C)',
      'Target Temp (C)',
      'Humidity (%)',
      'Status',
    ].join(',');

    const rows = filteredTrailers.map((t) =>
      [
        t.id,
        `"${t.carrier}"`,
        `"${t.cargo}"`,
        t.dockBay ?? 'Unassigned',
        `"${t.etaOrTime}"`,
        t.currentTempC.toFixed(1),
        t.targetTempC.toFixed(1),
        t.humidityPct,
        t.status,
      ].join(',')
    );

    const csvContent = [header, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'kestrel-yard-audit-sample.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setActionFeedback(`Exported ${filteredTrailers.length} trailer records to CSV.`);
  };

  return (
    <section id="live-demo" className="py-16 lg:py-20 bg-white border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-blue-800 mb-2">Interactive Product Sandbox</p>
            <h2
              className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900"
              style={{ textWrap: 'balance' }}
            >
              Test live dock assignment and thermal excursion handling.
            </h2>
            <p className="mt-2.5 text-base text-slate-600">
              Select any trailer below to reassign dock doors, adjust reefer setpoints, or export a
              compliance audit snapshot.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={handleResetDemo}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Reset Demo</span>
            </button>
          </div>
        </div>

        {/* Main Workbench Shell */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {/* Toolbar */}
          <div className="p-4 sm:px-6 bg-slate-50 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* Mode Switcher */}
              <div
                role="tablist"
                aria-label="Demo view mode"
                className="inline-flex items-center p-1 bg-slate-200/70 rounded-lg"
              >
                {DEMO_MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    role="tab"
                    aria-selected={mode === m.id}
                    onClick={() => setMode(m.id)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      mode === m.id
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {/* Status Filter Segmented Controls */}
              <div
                role="group"
                aria-label="Filter trailers by status"
                className="inline-flex items-center p-1 bg-slate-200/70 rounded-lg"
              >
                {STATUS_FILTERS.map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setStatusFilter(status)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      statusFilter === status
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {status === 'All' ? 'All Loads' : status}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Input */}
            <div className="relative w-full lg:w-64">
              <Search
                className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ID, carrier, cargo..."
                aria-label="Search trailers by ID, carrier, or cargo"
                className="w-full pl-9 pr-3 py-2 text-xs text-slate-900 bg-white border border-slate-300 rounded-lg placeholder:text-slate-400 focus:outline-none focus:border-blue-800 focus:ring-1 focus:ring-blue-800"
              />
            </div>
          </div>

          {/* Content Grid: Table + Live Inspector */}
          <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
            {/* Schedule Table */}
            <div className="lg:col-span-8 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50 text-xs font-semibold text-slate-500">
                    <th className="py-3 px-4 sm:px-6 whitespace-nowrap">Trailer</th>
                    <th className="py-3 px-4 whitespace-nowrap">Carrier &amp; Cargo</th>
                    {mode === 'dispatch' && (
                      <th className="py-3 px-4 whitespace-nowrap">Bay / Window</th>
                    )}
                    {mode === 'thermal' && (
                      <th className="py-3 px-4 whitespace-nowrap">Sensor / Humidity</th>
                    )}
                    {mode === 'gate' && (
                      <th className="py-3 px-4 whitespace-nowrap">Gate Lane / Seal</th>
                    )}
                    <th className="py-3 px-4 whitespace-nowrap text-right">Temp (°C)</th>
                    <th className="py-3 px-4 sm:px-6 whitespace-nowrap">State</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {filteredTrailers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 px-6 text-center text-slate-500">
                        <p className="text-sm font-medium text-slate-700">
                          No trailers match your current filter.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setStatusFilter('All');
                            setSearchQuery('');
                          }}
                          className="mt-3 text-xs font-semibold text-blue-800 hover:underline cursor-pointer"
                        >
                          Clear active filters
                        </button>
                      </td>
                    </tr>
                  ) : (
                    filteredTrailers.map((trailer) => {
                      const isSelected = trailer.id === selectedTrailer.id;
                      const tempDrift = Math.abs(trailer.currentTempC - trailer.targetTempC) > 1.5;

                      return (
                        <tr
                          key={trailer.id}
                          onClick={() => setSelectedId(trailer.id)}
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setSelectedId(trailer.id);
                            }
                          }}
                          className={`cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-blue-800 ${
                            isSelected ? 'bg-blue-50/60' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="py-3.5 px-4 sm:px-6 font-mono text-xs font-semibold text-slate-900 whitespace-nowrap">
                            {trailer.id}
                          </td>
                          <td className="py-3.5 px-4">
                            <p className="font-medium text-slate-900 leading-snug">
                              {trailer.carrier}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">{trailer.cargo}</p>
                          </td>

                          {mode === 'dispatch' && (
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <p className="text-xs font-semibold text-slate-900">
                                {trailer.dockBay ?? 'Yard Staging'}
                              </p>
                              <p className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
                                {trailer.etaOrTime}
                              </p>
                            </td>
                          )}

                          {mode === 'thermal' && (
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <p className="text-xs font-mono tabular-nums text-slate-900">
                                Target {trailer.targetTempC.toFixed(1)}°C
                              </p>
                              <p className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
                                RH {trailer.humidityPct}%
                              </p>
                            </td>
                          )}

                          {mode === 'gate' && (
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <p className="text-xs font-semibold text-slate-900">
                                {trailer.gateLane}
                              </p>
                              <p className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
                                Seal {trailer.sealNumber}
                              </p>
                            </td>
                          )}

                          <td
                            className={`py-3.5 px-4 text-right font-mono text-xs font-semibold tabular-nums whitespace-nowrap ${
                              tempDrift ? 'text-amber-800' : 'text-slate-900'
                            }`}
                          >
                            {trailer.currentTempC.toFixed(1)}°C
                          </td>
                          <td className="py-3.5 px-4 sm:px-6 whitespace-nowrap">
                            <StatusLabel status={trailer.status} />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Interactive Inspector Sidebar */}
            <aside className="lg:col-span-4 p-6 bg-slate-50/40 flex flex-col justify-between gap-6">
              <div>
                <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-200">
                  <div>
                    <p className="text-xs font-mono text-slate-500">{selectedTrailer.id}</p>
                    <h3 className="text-base font-semibold text-slate-900 mt-0.5">
                      {selectedTrailer.carrier}
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">{selectedTrailer.cargo}</p>
                  </div>
                  <StatusLabel status={selectedTrailer.status} />
                </div>

                {/* Bay Assignment Control */}
                <div className="mt-5">
                  <label
                    htmlFor="bay-select"
                    className="block text-xs font-semibold text-slate-700 mb-2"
                  >
                    Assign Dock Bay ({occupiedBays.size}/{AVAILABLE_DOCK_BAYS.length} bays active)
                  </label>
                  <select
                    id="bay-select"
                    value={selectedTrailer.dockBay ?? 'Unassigned'}
                    onChange={(e) => handleAssignBay(selectedTrailer.id, e.target.value)}
                    className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-800 focus:ring-1 focus:ring-blue-800 cursor-pointer"
                  >
                    <option value="Unassigned">Yard Staging (Unassigned)</option>
                    {AVAILABLE_DOCK_BAYS.map((bay) => {
                      const inUseByOther =
                        occupiedBays.has(bay) && selectedTrailer.dockBay !== bay;
                      return (
                        <option key={bay} value={bay} disabled={inUseByOther}>
                          {bay} {inUseByOther ? '(Occupied)' : '(Available)'}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Setpoint Telemetry Controls */}
                <div className="mt-5 pt-5 border-t border-slate-200">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-semibold text-slate-700">Reefer Chamber Telemetry</span>
                    <span className="font-mono tabular-nums text-slate-500">
                      RH {selectedTrailer.humidityPct}%
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 p-3 bg-white border border-slate-200 rounded-lg">
                    <div>
                      <p className="text-xs text-slate-500">Measured</p>
                      <p className="text-lg font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                        {selectedTrailer.currentTempC.toFixed(1)}°C
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Target Setpoint</p>
                      <p className="text-lg font-bold font-mono tabular-nums text-blue-900 mt-0.5">
                        {selectedTrailer.targetTempC.toFixed(1)}°C
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleAdjustSetpoint(selectedTrailer.id, -0.5)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>0.5°C</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAdjustSetpoint(selectedTrailer.id, 0.5)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>0.5°C</span>
                    </button>
                  </div>

                  {selectedTrailer.status === 'Alert' && (
                    <button
                      type="button"
                      onClick={() => handleStabilizeTemp(selectedTrailer.id)}
                      className="mt-3 w-full py-2 px-3 text-xs font-semibold text-white bg-blue-800 rounded-lg hover:bg-blue-900 transition-colors cursor-pointer"
                    >
                      Run Pre-Cool Verification
                    </button>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 text-xs text-slate-600 min-h-[2.25rem] flex items-center">
                {actionFeedback ? (
                  <p className="text-slate-800 font-medium">{actionFeedback}</p>
                ) : (
                  <p className="text-slate-500">
                    Gate {selectedTrailer.gateLane} · Seal {selectedTrailer.sealNumber}
                  </p>
                )}
              </div>
            </aside>
          </div>
        </div>
      </div>
    </section>
  );
}
