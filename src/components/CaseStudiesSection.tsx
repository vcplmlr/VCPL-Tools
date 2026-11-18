import { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { CASE_STUDIES, CaseStudy, ProjectDiscipline } from '../data/studioData';
import { SafeImage } from './SafeImage';

interface CaseStudiesSectionProps {
  onSelectStudy: (study: CaseStudy) => void;
}

const FILTER_OPTIONS: { id: ProjectDiscipline; label: string }[] = [
  { id: 'all', label: 'All Work' },
  { id: 'hardware', label: 'Hardware' },
  { id: 'spatial', label: 'Spatial' },
  { id: 'instruments', label: 'Instruments' },
];

export function CaseStudiesSection({ onSelectStudy }: CaseStudiesSectionProps) {
  const [activeFilter, setActiveFilter] = useState<ProjectDiscipline>('all');

  const filteredStudies =
    activeFilter === 'all'
      ? CASE_STUDIES
      : CASE_STUDIES.filter((study) => study.discipline === activeFilter);

  return (
    <section id="work" className="py-16 lg:py-24 border-b border-[#111214]/10 bg-[#FFFFFF]">
      <div className="max-w-[1280px] mx-auto px-6 lg:px-10">
        {/* Header & Interactive Segmented Filter */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div className="max-w-xl">
            <p className="text-xs font-medium text-[#5C6068] mb-3">
              Selected Work &amp; Impact
            </p>
            <h2 className="font-display text-2xl sm:text-3xl lg:text-[34px] font-semibold tracking-tight leading-[1.16] text-[#111214] text-balance">
              Measurable manufacturing and spatial outcomes.
            </h2>
          </div>

          <div
            role="group"
            aria-label="Filter case studies by discipline"
            className="inline-flex items-center gap-1 p-1 bg-[#EFEFEA] rounded-lg self-start md:self-auto"
          >
            {FILTER_OPTIONS.map((option) => {
              const isSelected = activeFilter === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setActiveFilter(option.id)}
                  aria-pressed={isSelected}
                  className={`px-3.5 py-2 text-xs font-medium rounded-md transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8] ${
                    isSelected
                      ? 'bg-white text-[#111214] shadow-xs'
                      : 'text-[#4A4E57] hover:text-[#111214]'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Case Study Grid */}
        <div
          className={`grid grid-cols-1 gap-8 ${
            filteredStudies.length === 1
              ? 'lg:grid-cols-1 max-w-2xl'
              : filteredStudies.length === 2
              ? 'lg:grid-cols-2'
              : 'lg:grid-cols-3'
          }`}
        >
          {filteredStudies.map((study) => (
            <article
              key={study.id}
              className="group flex flex-col bg-[#F7F7F5] border border-[#111214]/10 rounded-xl overflow-hidden transition-transform duration-150 hover:-translate-y-0.5"
            >
              <button
                type="button"
                onClick={() => onSelectStudy(study)}
                className="text-left flex flex-col h-full cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8]"
              >
                <div className="aspect-[4/3] w-full overflow-hidden bg-[#EAEAE5] border-b border-[#111214]/10">
                  <SafeImage
                    src={study.image}
                    alt={study.imageAlt}
                    fallbackTitle={study.title}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                </div>

                <div className="p-6 lg:p-7 flex flex-col flex-1 justify-between">
                  <div>
                    {/* Unboxed Metadata Line */}
                    <div className="flex items-center gap-2 text-xs text-[#5C6068] mb-2.5">
                      <span>{study.disciplineLabel}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{study.year}</span>
                      <span aria-hidden="true">·</span>
                      <span>{study.location}</span>
                    </div>

                    <h3 className="font-display text-lg lg:text-xl font-semibold tracking-tight text-[#111214] group-hover:text-[#1D4ED8] transition-colors duration-150">
                      {study.title}
                    </h3>

                    <p className="mt-2.5 text-sm leading-relaxed text-[#4A4E57]">
                      {study.summary}
                    </p>
                  </div>

                  {/* Quantified Proof Metric */}
                  <div className="mt-6 pt-5 border-t border-[#111214]/10 flex items-end justify-between gap-4">
                    <div>
                      <p className="font-display text-lg font-semibold text-[#111214] tabular-nums">
                        {study.headlineMetric}
                      </p>
                      <p className="text-xs text-[#5C6068] mt-0.5 line-clamp-1">
                        {study.metricContext}
                      </p>
                    </div>
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-[#111214]/12 text-[#111214] group-hover:border-[#1D4ED8] group-hover:text-[#1D4ED8] transition-colors shrink-0">
                      <ArrowUpRight className="w-4 h-4" strokeWidth={1.75} />
                    </span>
                  </div>
                </div>
              </button>
            </article>
          ))}
        </div>

        {/* Client Evidence Quote adjacent to Case Studies */}
        <div className="mt-12 pt-10 border-t border-[#111214]/10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-3">
            <p className="text-xs font-medium text-[#5C6068]">Client Verification</p>
          </div>
          <div className="lg:col-span-9">
            <blockquote className="text-base lg:text-lg leading-relaxed text-[#111214] max-w-[68ch]">
              “{CASE_STUDIES[0].testimonial.quote}”
            </blockquote>
            <p className="mt-3 text-xs text-[#5C6068]">
              <span className="font-medium text-[#111214]">
                {CASE_STUDIES[0].testimonial.author}
              </span>
              {' · '}
              {CASE_STUDIES[0].testimonial.role}, {CASE_STUDIES[0].testimonial.organization}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
