import {HERO_MEDIA} from '../data/siteData';
import {SafeImage} from './SafeImage';

export function CapabilitiesSection() {
  return (
    <section id="capabilities" className="py-16 lg:py-24 border-b border-neutral-200">
      <div className="max-w-[1200px] mx-auto px-6 lg:px-8">
        <div className="max-w-2xl mb-12">
          <p className="text-xs font-medium tracking-wide text-[#575652] mb-3">
            Engineering &amp; Fabrication
          </p>
          <h2 className="text-2xl lg:text-4xl font-semibold tracking-tight text-[#141413] text-balance">
            Built like architectural cabinetry, tested to acoustic laboratory standards
          </h2>
        </div>

        {/* Asymmetric 3-column bento layout (2+1 and 1+2) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Marquee capability 01 (col-span-2) */}
          <article className="lg:col-span-2 bg-white border border-neutral-200 rounded-xl p-6 lg:p-8 flex flex-col justify-between gap-8">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              <div className="md:col-span-7 space-y-4">
                <h3 className="text-xl font-semibold text-[#141413]">
                  01. Multi-Layer Acoustic Envelope
                </h3>
                <p className="text-[15px] leading-relaxed text-[#4A4945]">
                  Every wall panel combines 22 mm FSC-certified hardwood slats, high-density recycled PET felt, a viscoelastic damping membrane, and micro-perforated birch core to absorb mid-to-high speech frequencies without echoing.
                </p>
                <div className="pt-2 flex flex-wrap gap-x-6 gap-y-2 text-xs text-[#575652] font-mono tabular-nums">
                  <span>STC 38 Wall Assembly</span>
                  <span aria-hidden="true">·</span>
                  <span>NRC 0.85 Interior Absorption</span>
                  <span aria-hidden="true">·</span>
                  <span>Zero Fiberglass</span>
                </div>
              </div>

              <div className="md:col-span-5 aspect-[4/3] rounded-lg overflow-hidden border border-neutral-200 bg-[#EAE9E4]">
                <SafeImage
                  src={HERO_MEDIA.timberDetailImage}
                  alt={HERO_MEDIA.timberDetailAlt}
                  fallbackTitle="Quarter-Sawn Timber Joinery"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </article>

          {/* Capability 02 (col-span-1) */}
          <article className="bg-white border border-neutral-200 rounded-xl p-6 lg:p-8 flex flex-col justify-between gap-6">
            <div className="space-y-3">
              <h3 className="text-xl font-semibold text-[#141413]">
                02. Dry-Joint Cam Milling
              </h3>
              <p className="text-[15px] leading-relaxed text-[#4A4945]">
                CNC-milled anodized aluminum corner extrusions lock walls together using concealed compression cams—no wet adhesives, drywall dust, or floor anchors.
              </p>
            </div>
            <div className="pt-4 border-t border-neutral-200 flex items-baseline justify-between">
              <span className="text-xs text-[#575652]">Average Room Assembly</span>
              <span className="text-lg font-semibold font-mono tabular-nums text-[#141413]">
                4.5 hrs
              </span>
            </div>
          </article>

          {/* Capability 03 (col-span-1) */}
          <article className="bg-white border border-neutral-200 rounded-xl p-6 lg:p-8 flex flex-col justify-between gap-6">
            <div className="space-y-3">
              <h3 className="text-xl font-semibold text-[#141413]">
                03. Silent Laminar Ventilation
              </h3>
              <p className="text-[15px] leading-relaxed text-[#4A4945]">
                Dual baffled ceiling plenums cycle fresh conditioned air through sound-trapped S-bends so CO₂ stays below 750 ppm during back-to-back workshops.
              </p>
            </div>
            <div className="pt-4 border-t border-neutral-200 flex items-baseline justify-between">
              <span className="text-xs text-[#575652]">Plenum Noise Floor</span>
              <span className="text-lg font-semibold font-mono tabular-nums text-[#141413]">
                &lt; 24 dBA
              </span>
            </div>
          </article>

          {/* Marquee capability 04 (col-span-2) */}
          <article className="lg:col-span-2 bg-[#EFEFEC] border border-neutral-200 rounded-xl p-6 lg:p-8 flex flex-col justify-between gap-6">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              <div className="md:col-span-7 space-y-3">
                <h3 className="text-xl font-semibold text-[#141413]">
                  04. Lease-Portable Capital Asset
                </h3>
                <p className="text-[15px] leading-relaxed text-[#4A4945]">
                  Instead of writing off permanent drywall partitions when your office lease ends, every Haldor pavilion disassembles cleanly in under three hours and moves with your team to a new floorplate.
                </p>
              </div>
              <div className="md:col-span-5 grid grid-cols-2 gap-4 pt-1">
                <div className="border-t border-neutral-300 pt-3">
                  <div className="text-xl font-semibold font-mono tabular-nums text-[#141413]">
                    10 yr
                  </div>
                  <div className="text-xs text-[#575652] mt-1">Structural frame warranty</div>
                </div>
                <div className="border-t border-neutral-300 pt-3">
                  <div className="text-xl font-semibold font-mono tabular-nums text-[#141413]">
                    18 days
                  </div>
                  <div className="text-xs text-[#575652] mt-1">Workshop dispatch lead</div>
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
