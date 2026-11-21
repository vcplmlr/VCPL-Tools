import {useState} from 'react';
import {ArrowUpRight, X} from 'lucide-react';
import {CASE_STUDIES, CaseStudy} from '../data/siteData';
import {SafeImage} from './SafeImage';

type FilterCategory = 'All' | CaseStudy['category'];

const FILTER_OPTIONS: FilterCategory[] = [
  'All',
  'Corporate HQ',
  'Audio & Media',
  'Research Labs',
];

export function CaseStudiesSection() {
  const [activeCategory, setActiveCategory] = useState<FilterCategory>('All');
  const [selectedStudy, setSelectedStudy] = useState<CaseStudy | null>(null);

  const visibleStudies =
    activeCategory === 'All'
      ? CASE_STUDIES
      : CASE_STUDIES.filter((study) => study.category === activeCategory);

  return (
    <section id="case-studies" className="py-16 lg:py-24 border-b border-neutral-200">
      <div className="max-w-[1200px] mx-auto px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div className="max-w-xl">
            <p className="text-xs font-medium tracking-wide text-[#575652] mb-3">
              Verified Installations
            </p>
            <h2 className="text-2xl lg:text-4xl font-semibold tracking-tight text-[#141413] text-balance">
              Measured acoustic outcomes across active client spaces
            </h2>
          </div>

          {/* Interactive Filter Controls */}
          <div
            role="tablist"
            aria-label="Filter installations by sector"
            className="inline-flex flex-wrap items-center gap-1 p-1 bg-[#EFEFEC] border border-neutral-200 rounded-lg self-start md:self-auto"
          >
            {FILTER_OPTIONS.map((category) => {
              const active = activeCategory === category;
              return (
                <button
                  key={category}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveCategory(category)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-white text-[#141413] shadow-sm'
                      : 'text-[#575652] hover:text-[#141413]'
                  }`}
                >
                  {category === 'All' ? 'All Projects' : category}
                </button>
              );
            })}
          </div>
        </div>

        {/* Case Study Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {visibleStudies.map((study, index) => (
            <article
              key={study.id}
              className={`bg-white border border-neutral-200 rounded-xl overflow-hidden flex flex-col justify-between ${
                visibleStudies.length === 3 && index === 0 ? 'lg:col-span-2 lg:grid lg:grid-cols-12' : ''
              }`}
            >
              <div
                className={`aspect-[4/3] bg-[#EAE9E4] overflow-hidden ${
                  visibleStudies.length === 3 && index === 0 ? 'lg:col-span-6 lg:aspect-auto lg:h-full' : ''
                }`}
              >
                <SafeImage
                  src={study.image}
                  alt={study.imageAlt}
                  fallbackTitle={study.client}
                  className="w-full h-full object-cover"
                />
              </div>

              <div
                className={`p-6 lg:p-8 flex flex-col justify-between gap-6 ${
                  visibleStudies.length === 3 && index === 0 ? 'lg:col-span-6' : ''
                }`}
              >
                <div>
                  {/* Zero-pill unboxed metadata */}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#575652] mb-3">
                    <span>{study.location}</span>
                    <span aria-hidden="true">·</span>
                    <span>{study.category}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{study.year}</span>
                  </div>

                  <h3 className="text-xl lg:text-2xl font-semibold text-[#141413] tracking-tight mb-3">
                    {study.title}
                  </h3>

                  <p className="text-[15px] leading-relaxed text-[#4A4945] mb-6">
                    {study.summary}
                  </p>

                  {/* Quantified metrics */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-neutral-200">
                    <div>
                      <div className="text-base font-semibold font-mono tabular-nums text-[#141413]">
                        {study.primaryMetric}
                      </div>
                      <div className="text-xs text-[#575652] mt-0.5">Measured performance</div>
                    </div>
                    <div>
                      <div className="text-base font-semibold font-mono tabular-nums text-[#141413]">
                        {study.secondaryMetric}
                      </div>
                      <div className="text-xs text-[#575652] mt-0.5">Post-occupancy impact</div>
                    </div>
                  </div>
                </div>

                {/* Adjacent attributable testimonial & action */}
                <div className="pt-5 border-t border-neutral-200 space-y-4">
                  <blockquote className="text-sm leading-relaxed text-[#4A4945]">
                    &ldquo;{study.testimonial.quote}&rdquo;
                  </blockquote>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="text-xs text-[#575652]">
                      <span className="font-semibold text-[#141413]">
                        {study.testimonial.author}
                      </span>{' '}
                      · {study.testimonial.role}, {study.testimonial.company}
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedStudy(study)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#1E40AF] hover:text-[#1E3A8A] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E40AF] rounded-sm"
                    >
                      <span>Inspect Acoustic Report</span>
                      <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* Acoustic Report Modal */}
      {selectedStudy && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="study-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
          onClick={() => setSelectedStudy(null)}
        >
          <div
            className="bg-white border border-neutral-200 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 lg:p-8 space-y-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-neutral-200">
              <div>
                <div className="text-xs text-[#575652] mb-1">
                  {selectedStudy.client} · {selectedStudy.location}
                </div>
                <h3 id="study-modal-title" className="text-xl lg:text-2xl font-semibold text-[#141413]">
                  {selectedStudy.title}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setSelectedStudy(null)}
                aria-label="Close acoustic report"
                className="w-10 h-10 inline-flex items-center justify-center rounded-lg text-[#575652] hover:bg-neutral-100 hover:text-[#141413] shrink-0 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#F7F7F5] border border-neutral-200 rounded-lg p-4">
              <div>
                <div className="text-xs text-[#575652]">Primary Acoustic Result</div>
                <div className="text-base font-semibold font-mono tabular-nums text-[#141413] mt-0.5">
                  {selectedStudy.primaryMetric}
                </div>
              </div>
              <div>
                <div className="text-xs text-[#575652]">Operational Outcome</div>
                <div className="text-base font-semibold font-mono tabular-nums text-[#141413] mt-0.5">
                  {selectedStudy.secondaryMetric}
                </div>
              </div>
            </div>

            <div className="space-y-4 text-sm leading-relaxed text-[#4A4945]">
              <div>
                <h4 className="font-semibold text-[#141413] mb-1">Site Challenge</h4>
                <p>{selectedStudy.challenge}</p>
              </div>
              <div>
                <h4 className="font-semibold text-[#141413] mb-1">Installed Specification</h4>
                <p className="font-mono text-xs text-[#141413]">{selectedStudy.specsUsed}</p>
              </div>
              <div>
                <h4 className="font-semibold text-[#141413] mb-1">Verified Outcome</h4>
                <p>{selectedStudy.outcome}</p>
              </div>
            </div>

            <div className="pt-4 border-t border-neutral-200 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedStudy(null)}
                className="px-4 py-2 text-sm font-medium text-white bg-[#1E40AF] hover:bg-[#1E3A8A] rounded-lg transition-colors cursor-pointer"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
