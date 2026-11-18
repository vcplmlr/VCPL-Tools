import { useState } from 'react';
import { CAPABILITIES, MATERIAL_SPECS } from '../data/studioData';

export function CapabilitiesSection() {
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>(MATERIAL_SPECS[0].id);

  const activeMaterial =
    MATERIAL_SPECS.find((m) => m.id === selectedMaterialId) ?? MATERIAL_SPECS[0];

  return (
    <section id="capabilities" className="py-16 lg:py-24 border-b border-[#111214]/10">
      <div className="max-w-[1280px] mx-auto px-6 lg:px-10">
        {/* Section Header */}
        <div className="max-w-2xl mb-12 lg:mb-14">
          <p className="text-xs font-medium text-[#5C6068] mb-3">
            Studio Capabilities
          </p>
          <h2 className="font-display text-2xl sm:text-3xl lg:text-[34px] font-semibold tracking-tight leading-[1.16] text-[#111214] text-balance">
            Integrated physical engineering from sketch model to factory sign-off.
          </h2>
        </div>

        {/* Asymmetric Bento Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {CAPABILITIES.map((cap) => (
            <article
              key={cap.id}
              className={`${cap.spanClass} bg-white border border-[#111214]/10 rounded-xl p-7 lg:p-8 flex flex-col justify-between`}
            >
              <div>
                <h3 className="font-display text-lg lg:text-xl font-semibold tracking-tight text-[#111214]">
                  <span className="font-mono text-sm font-medium text-[#1D4ED8] mr-2.5 tabular-nums">
                    {cap.index}
                  </span>
                  {cap.title}
                </h3>

                <p className="mt-3.5 text-[15px] leading-[1.65] text-[#4A4E57] max-w-[60ch]">
                  {cap.summary}
                </p>
              </div>

              <ul className="mt-6 pt-5 border-t border-[#111214]/8 space-y-2">
                {cap.deliverables.map((item) => (
                  <li
                    key={item}
                    className="text-xs sm:text-[13px] text-[#33363D] flex items-baseline gap-2.5"
                  >
                    <span className="text-[#1D4ED8] font-mono text-[11px]" aria-hidden="true">
                      —
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        {/* Interactive Material & Tolerance Lab Strip */}
        <div
          id="materials"
          className="mt-14 pt-12 border-t border-[#111214]/10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
        >
          <div className="lg:col-span-4 space-y-3">
            <p className="text-xs font-medium text-[#5C6068]">Material &amp; Finish Lab</p>
            <h3 className="font-display text-xl font-semibold tracking-tight text-[#111214]">
              Verified Surface Specifications
            </h3>
            <p className="text-sm leading-relaxed text-[#4A4E57]">
              Inspect our standard substrate tolerances and acoustic finishes archived across our Zurich and Kyoto workshops.
            </p>
          </div>

          <div className="lg:col-span-8 bg-white border border-[#111214]/10 rounded-xl p-6 lg:p-7">
            {/* Segmented Material Selector */}
            <div
              role="tablist"
              aria-label="Material finish presets"
              className="inline-flex flex-wrap items-center gap-1 p-1 bg-[#EFEFEA] rounded-lg mb-6"
            >
              {MATERIAL_SPECS.map((mat) => {
                const isActive = mat.id === activeMaterial.id;
                return (
                  <button
                    key={mat.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setSelectedMaterialId(mat.id)}
                    className={`px-3.5 py-2 text-xs font-medium rounded-md transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8] ${
                      isActive
                        ? 'bg-white text-[#111214] shadow-xs'
                        : 'text-[#4A4E57] hover:text-[#111214]'
                    }`}
                  >
                    {mat.code}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-center">
              <div className="sm:col-span-3">
                <div
                  className="w-full h-24 rounded-lg border border-[#111214]/12 transition-colors duration-200"
                  style={{ backgroundColor: activeMaterial.swatchColor }}
                  aria-label={`Material swatch for ${activeMaterial.name}`}
                />
              </div>

              <div className="sm:col-span-9 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                <div className="sm:col-span-2">
                  <p className="text-xs text-[#5C6068]">Substrate</p>
                  <p className="font-display text-base font-semibold text-[#111214] mt-0.5">
                    {activeMaterial.name}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#5C6068]">Surface Treatment</p>
                  <p className="text-sm text-[#111214] mt-0.5">{activeMaterial.finish}</p>
                </div>
                <div>
                  <p className="text-xs text-[#5C6068]">Machining Tolerance</p>
                  <p className="font-mono text-xs text-[#111214] mt-1 tabular-nums">
                    {activeMaterial.tolerance}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs text-[#5C6068]">Primary Applications</p>
                  <p className="text-sm text-[#4A4E57] mt-0.5">{activeMaterial.application}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
