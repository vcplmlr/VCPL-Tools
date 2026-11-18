import { useEffect } from 'react';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import { CASE_STUDIES, CaseStudy } from '../data/studioData';
import { SafeImage } from './SafeImage';

interface CaseStudyModalProps {
  study: CaseStudy | null;
  onClose: () => void;
  onSelectStudy: (study: CaseStudy) => void;
  onInquireDiscipline: (disciplineLabel: string) => void;
}

export function CaseStudyModal({
  study,
  onClose,
  onSelectStudy,
  onInquireDiscipline,
}: CaseStudyModalProps) {
  useEffect(() => {
    if (!study) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [study, onClose]);

  if (!study) return null;

  const currentIndex = CASE_STUDIES.findIndex((item) => item.id === study.id);
  const prevStudy =
    CASE_STUDIES[(currentIndex - 1 + CASE_STUDIES.length) % CASE_STUDIES.length];
  const nextStudy = CASE_STUDIES[(currentIndex + 1) % CASE_STUDIES.length];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="case-study-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#111214]/60 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-[#F7F7F5] border border-[#111214]/15 rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Modal Bar */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 px-6 py-4 bg-[#F7F7F5]/95 backdrop-blur-sm border-b border-[#111214]/10">
          <div className="flex items-center gap-2 text-xs text-[#5C6068]">
            <span>{study.client}</span>
            <span aria-hidden="true">·</span>
            <span>{study.disciplineLabel}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{study.year}</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close case study"
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-[#111214] hover:bg-[#111214]/8 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 sm:p-8 space-y-8">
          <div className="aspect-[16/10] w-full rounded-xl overflow-hidden border border-[#111214]/10 bg-[#EAEAE5]">
            <SafeImage
              src={study.image}
              alt={study.imageAlt}
              fallbackTitle={study.title}
              className="w-full h-full object-cover"
            />
          </div>

          <div>
            <h2
              id="case-study-modal-title"
              className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-[#111214] text-balance"
            >
              {study.title}
            </h2>
            <p className="mt-3 text-base leading-relaxed text-[#4A4E57] max-w-[65ch]">
              {study.summary}
            </p>
          </div>

          {/* Outcome Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-5 border-y border-[#111214]/10">
            {study.outcomes.map((outcome) => (
              <div key={outcome.label}>
                <p className="font-display text-2xl font-semibold text-[#111214] tabular-nums">
                  {outcome.value}
                </p>
                <p className="text-xs text-[#5C6068] mt-1">{outcome.label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="font-display text-sm font-semibold text-[#111214] mb-2">
                Engineering Constraint
              </h3>
              <p className="text-sm leading-relaxed text-[#4A4E57]">{study.challenge}</p>
            </div>
            <div>
              <h3 className="font-display text-sm font-semibold text-[#111214] mb-2">
                Architectural Resolution
              </h3>
              <p className="text-sm leading-relaxed text-[#4A4E57]">{study.solution}</p>
            </div>
          </div>

          {/* Client Quote */}
          <div className="bg-white border border-[#111214]/10 rounded-xl p-6">
            <blockquote className="text-sm sm:text-base leading-relaxed text-[#111214]">
              “{study.testimonial.quote}”
            </blockquote>
            <p className="mt-3 text-xs text-[#5C6068]">
              <span className="font-medium text-[#111214]">{study.testimonial.author}</span>
              {' · '}
              {study.testimonial.role}, {study.testimonial.organization}
            </p>
          </div>

          {/* Modal Footer Controls */}
          <div className="pt-4 border-t border-[#111214]/10 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onSelectStudy(prevStudy)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#111214] bg-white border border-[#111214]/12 rounded-lg hover:border-[#111214]/30 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>
              <button
                type="button"
                onClick={() => onSelectStudy(nextStudy)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#111214] bg-white border border-[#111214]/12 rounded-lg hover:border-[#111214]/30 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <span>Next</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                onInquireDiscipline(study.disciplineLabel);
                onClose();
              }}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#1D4ED8] hover:bg-[#1E40AF] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Request Similar Scope
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
