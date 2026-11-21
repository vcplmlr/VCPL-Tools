import {useState} from 'react';
import {Check, Minus, Plus} from 'lucide-react';
import {
  GLAZING_OPTIONS,
  PAVILION_MODELS,
  TIMBER_FINISHES,
} from '../data/siteData';

export interface ConfiguredSpec {
  modelName: string;
  finishName: string;
  glazingName: string;
  quantity: number;
  estimatedTotalUsd: number;
  ratingDb: number;
}

interface PavilionConfiguratorProps {
  onApplySpec: (spec: ConfiguredSpec) => void;
}

export function PavilionConfigurator({onApplySpec}: PavilionConfiguratorProps) {
  const [selectedModelId, setSelectedModelId] = useState<string>(PAVILION_MODELS[2].id);
  const [selectedFinishId, setSelectedFinishId] = useState<string>(TIMBER_FINISHES[0].id);
  const [selectedGlazingId, setSelectedGlazingId] = useState<string>(GLAZING_OPTIONS[1].id);
  const [quantity, setQuantity] = useState<number>(2);
  const [unitMetric, setUnitMetric] = useState<'mm' | 'ft'>('mm');

  const model = PAVILION_MODELS.find((m) => m.id === selectedModelId) ?? PAVILION_MODELS[0];
  const finish = TIMBER_FINISHES.find((f) => f.id === selectedFinishId) ?? TIMBER_FINISHES[0];
  const glazing = GLAZING_OPTIONS.find((g) => g.id === selectedGlazingId) ?? GLAZING_OPTIONS[0];

  const unitPrice = model.basePriceUsd + finish.priceDeltaUsd + glazing.priceDeltaUsd;
  const volumeDiscountRate = quantity >= 5 ? 0.08 : quantity >= 3 ? 0.04 : 0;
  const subtotal = unitPrice * quantity;
  const estimatedTotal = Math.round(subtotal * (1 - volumeDiscountRate));
  const totalAssemblyHours = +(model.assemblyHours * quantity).toFixed(1);

  const handleApply = () => {
    onApplySpec({
      modelName: model.name,
      finishName: finish.name,
      glazingName: glazing.name,
      quantity,
      estimatedTotalUsd: estimatedTotal,
      ratingDb: glazing.ratingDb,
    });
  };

  return (
    <section id="configurator" className="py-16 lg:py-24 bg-white border-b border-neutral-200">
      <div className="max-w-[1200px] mx-auto px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div className="max-w-2xl">
            <p className="text-xs font-medium tracking-wide text-[#575652] mb-3">
              Interactive Specification Estimator
            </p>
            <h2 className="text-2xl lg:text-4xl font-semibold tracking-tight text-[#141413] text-balance">
              Configure footprint, timber finish, and glazing attenuation
            </h2>
          </div>

          {/* Dimension unit segmented toggle */}
          <div
            role="group"
            aria-label="Measurement units"
            className="inline-flex items-center p-1 bg-[#F7F7F5] border border-neutral-200 rounded-lg self-start md:self-auto"
          >
            <button
              type="button"
              onClick={() => setUnitMetric('mm')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                unitMetric === 'mm'
                  ? 'bg-white text-[#141413] shadow-sm'
                  : 'text-[#575652] hover:text-[#141413]'
              }`}
            >
              Metric (mm)
            </button>
            <button
              type="button"
              onClick={() => setUnitMetric('ft')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                unitMetric === 'ft'
                  ? 'bg-white text-[#141413] shadow-sm'
                  : 'text-[#575652] hover:text-[#141413]'
              }`}
            >
              Imperial (ft)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left 7 cols: Controls */}
          <div className="lg:col-span-7 space-y-8">
            {/* Step 1: Footprint Model */}
            <div>
              <h3 className="text-sm font-semibold text-[#141413] mb-3">
                01. Select Pavilion Footprint
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PAVILION_MODELS.map((item) => {
                  const active = item.id === selectedModelId;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedModelId(item.id)}
                      aria-pressed={active}
                      className={`text-left p-4 rounded-xl border transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E40AF] ${
                        active
                          ? 'bg-[#F7F7F5] border-[#1E40AF]'
                          : 'bg-white border-neutral-200 hover:border-neutral-400'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-sm font-semibold text-[#141413]">{item.name}</span>
                        <span className="text-xs font-mono tabular-nums text-[#575652]">
                          {item.capacity}
                        </span>
                      </div>
                      <p className="text-xs text-[#575652] font-mono tabular-nums mb-2">
                        {unitMetric === 'mm' ? item.footprintMm : item.footprintFt}
                      </p>
                      <p className="text-xs text-[#4A4945] leading-relaxed">{item.summary}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Timber Veneer */}
            <div>
              <h3 className="text-sm font-semibold text-[#141413] mb-3">
                02. Exterior Timber Louver Finish
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {TIMBER_FINISHES.map((item) => {
                  const active = item.id === selectedFinishId;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedFinishId(item.id)}
                      aria-pressed={active}
                      className={`text-left p-4 rounded-xl border transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E40AF] ${
                        active
                          ? 'bg-[#F7F7F5] border-[#1E40AF]'
                          : 'bg-white border-neutral-200 hover:border-neutral-400'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span
                          className="w-7 h-7 rounded-md border border-black/15 shrink-0"
                          style={{backgroundColor: item.swatchHex}}
                          aria-hidden="true"
                        />
                        {active && (
                          <Check className="w-4 h-4 text-[#1E40AF] shrink-0" aria-hidden="true" />
                        )}
                      </div>
                      <div className="text-sm font-semibold text-[#141413] mb-0.5">
                        {item.name}
                      </div>
                      <div className="text-xs text-[#575652] mb-2">{item.origin}</div>
                      <div className="text-xs font-mono tabular-nums text-[#141413]">
                        {item.priceDeltaUsd === 0
                          ? 'Included'
                          : `+$${item.priceDeltaUsd.toLocaleString()} / unit`}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 3: Acoustic Glazing */}
            <div>
              <h3 className="text-sm font-semibold text-[#141413] mb-3">
                03. Acoustic Glass Specification
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {GLAZING_OPTIONS.map((item) => {
                  const active = item.id === selectedGlazingId;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedGlazingId(item.id)}
                      aria-pressed={active}
                      className={`text-left p-4 rounded-xl border transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E40AF] ${
                        active
                          ? 'bg-[#F7F7F5] border-[#1E40AF]'
                          : 'bg-white border-neutral-200 hover:border-neutral-400'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-sm font-semibold text-[#141413]">{item.name}</span>
                        <span className="text-xs font-mono tabular-nums font-medium text-[#1E40AF]">
                          -{item.ratingDb} dB
                        </span>
                      </div>
                      <p className="text-xs text-[#575652] mb-2">{item.specDetail}</p>
                      <span className="text-xs font-mono tabular-nums text-[#141413]">
                        {item.priceDeltaUsd === 0
                          ? 'Standard glazing'
                          : `+$${item.priceDeltaUsd.toLocaleString()} / unit`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right 5 cols: Live Specification Summary */}
          <aside className="lg:col-span-5 bg-[#F7F7F5] border border-neutral-200 rounded-xl p-6 lg:p-8 space-y-6">
            <div className="flex items-start justify-between gap-4 pb-5 border-b border-neutral-200">
              <div>
                <p className="text-xs text-[#575652] mb-1">Configured Assembly</p>
                <h3 className="text-xl font-semibold text-[#141413]">{model.name}</h3>
                <p className="text-sm text-[#4A4945] mt-1">
                  {finish.name} · -{glazing.ratingDb} dB Glazing
                </p>
              </div>

              <span
                className="w-10 h-10 rounded-lg border border-black/15 shrink-0"
                style={{backgroundColor: finish.swatchHex}}
                title={finish.name}
                aria-hidden="true"
              />
            </div>

            {/* Technical spec rows */}
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-[#575652]">Exterior Dimensions</dt>
                <dd className="font-mono tabular-nums text-[#141413]">
                  {unitMetric === 'mm' ? model.footprintMm : model.footprintFt}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-[#575652]">Speech Attenuation</dt>
                <dd className="font-mono tabular-nums text-[#141413]">
                  -{glazing.ratingDb} dB (ISO 23351-1)
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-[#575652]">Fresh Air Exchange</dt>
                <dd className="font-mono tabular-nums text-[#141413]">{model.airflowLs} L/s</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-[#575652]">Estimated Installation</dt>
                <dd className="font-mono tabular-nums text-[#141413]">
                  {totalAssemblyHours} hrs ({quantity} {quantity === 1 ? 'unit' : 'units'})
                </dd>
              </div>
            </dl>

            {/* Quantity selector */}
            <div className="pt-5 border-t border-neutral-200 flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-[#141413]">Unit Quantity</div>
                <div className="text-xs text-[#575652]">
                  {volumeDiscountRate > 0
                    ? `${Math.round(volumeDiscountRate * 100)}% multi-unit fabrication discount applied`
                    : '3+ units qualify for multi-unit pricing'}
                </div>
              </div>

              <div className="inline-flex items-center border border-neutral-300 bg-white rounded-lg">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  aria-label="Decrease quantity"
                  className="w-10 h-10 flex items-center justify-center text-[#141413] hover:bg-neutral-100 rounded-l-lg transition-colors cursor-pointer"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-10 text-center text-sm font-mono tabular-nums font-medium text-[#141413]">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(12, q + 1))}
                  aria-label="Increase quantity"
                  className="w-10 h-10 flex items-center justify-center text-[#141413] hover:bg-neutral-100 rounded-r-lg transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Pricing total + action */}
            <div className="pt-5 border-t border-neutral-200 space-y-4">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-sm text-[#575652]">Estimated Ex-Works Total</span>
                <span className="text-2xl lg:text-3xl font-semibold font-mono tabular-nums text-[#141413]">
                  ${estimatedTotal.toLocaleString()}
                </span>
              </div>

              <button
                type="button"
                onClick={handleApply}
                className="w-full py-3 px-4 text-sm font-medium text-white bg-[#1E40AF] hover:bg-[#1E3A8A] rounded-lg transition-colors duration-150 whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E40AF] focus-visible:ring-offset-2"
              >
                Apply Specs to Quote Request
              </button>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
