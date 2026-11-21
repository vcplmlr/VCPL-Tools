import {useState, FormEvent} from 'react';
import {AlertCircle, CheckCircle2, X} from 'lucide-react';
import {ConfiguredSpec} from './PavilionConfigurator';

interface QuoteSectionProps {
  appliedSpec: ConfiguredSpec | null;
  onClearSpec: () => void;
}

interface FormValues {
  fullName: string;
  workEmail: string;
  company: string;
  city: string;
  timeline: string;
  notes: string;
}

interface FormErrors {
  fullName?: string;
  workEmail?: string;
  company?: string;
  city?: string;
}

const INITIAL_VALUES: FormValues = {
  fullName: '',
  workEmail: '',
  company: '',
  city: '',
  timeline: 'Within 60 days',
  notes: '',
};

export function QuoteSection({appliedSpec, onClearSpec}: QuoteSectionProps) {
  const [values, setValues] = useState<FormValues>(INITIAL_VALUES);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);

  const validate = (): FormErrors => {
    const next: FormErrors = {};
    if (!values.fullName.trim() || values.fullName.trim().length < 2) {
      next.fullName = 'Enter your full name.';
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!values.workEmail.trim() || !emailPattern.test(values.workEmail.trim())) {
      next.workEmail = 'Enter a valid work email address.';
    }
    if (!values.company.trim()) {
      next.company = 'Enter your organization or studio name.';
    }
    if (!values.city.trim()) {
      next.city = 'Enter the installation city.';
    }
    return next;
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    const code = `HS-${Math.floor(1040 + Math.random() * 8900)}`;
    setSubmittedRef(code);
  };

  const handleReset = () => {
    setValues(INITIAL_VALUES);
    setErrors({});
    setSubmittedRef(null);
  };

  return (
    <section id="quote" className="py-16 lg:py-24 bg-white border-b border-neutral-200">
      <div className="max-w-[1200px] mx-auto px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Left column: context & deliverables */}
          <div className="lg:col-span-5 space-y-6">
            <div>
              <p className="text-xs font-medium tracking-wide text-[#575652] mb-3">
                Project Specification &amp; Lead Times
              </p>
              <h2 className="text-2xl lg:text-4xl font-semibold tracking-tight text-[#141413] text-balance">
                Request floorplate drawings and fabrication pricing
              </h2>
            </div>

            <p className="text-[15px] leading-relaxed text-[#4A4945]">
              Submit your installation city and unit requirements. Within one business day, an acoustic engineer returns CAD elevation drawings, freight schedules, and itemized fabrication pricing.
            </p>

            <div className="pt-6 border-t border-neutral-200 space-y-4">
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-[#575652]">North America Workshop</span>
                <span className="font-medium text-[#141413]">Portland, Oregon</span>
              </div>
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-[#575652]">European Workshop</span>
                <span className="font-medium text-[#141413]">Zurich, Switzerland</span>
              </div>
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-[#575652]">Direct Engineering Desk</span>
                <span className="font-mono text-xs text-[#141413]">specs@haldorsystems.com</span>
              </div>
            </div>
          </div>

          {/* Right column: Interactive Lead Capture Form */}
          <div className="lg:col-span-7 bg-[#F7F7F5] border border-neutral-200 rounded-xl p-6 lg:p-8">
            {submittedRef ? (
              <div className="py-6 space-y-6">
                <div className="flex items-start gap-3">
                  <CheckCircle2
                    className="w-6 h-6 text-[#1E40AF] shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <div>
                    <h3 className="text-xl font-semibold text-[#141413]">
                      Specification brief logged
                    </h3>
                    <p className="text-sm text-[#4A4945] mt-1">
                      Reference <span className="font-mono font-medium text-[#141413]">{submittedRef}</span> has been assigned to our regional fabrication team for <span className="font-medium text-[#141413]">{values.company}</span> ({values.city}).
                    </p>
                  </div>
                </div>

                <div className="bg-white border border-neutral-200 rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-[#575652]">Contact</span>
                    <span className="text-[#141413] font-medium">
                      {values.fullName} · {values.workEmail}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-[#575652]">Target Schedule</span>
                    <span className="text-[#141413]">{values.timeline}</span>
                  </div>
                  {appliedSpec && (
                    <div className="flex justify-between gap-4 pt-2 border-t border-neutral-200">
                      <span className="text-[#575652]">Configured Units</span>
                      <span className="font-mono text-xs text-[#141413] text-right">
                        {appliedSpec.quantity}× {appliedSpec.modelName} ({appliedSpec.finishName})
                      </span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-2 text-sm font-medium text-[#141413] bg-white hover:bg-neutral-100 border border-neutral-300 rounded-lg transition-colors cursor-pointer"
                >
                  Submit Another Brief
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="space-y-5">
                {appliedSpec && (
                  <div className="bg-white border border-neutral-200 rounded-lg p-4 flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs font-medium text-[#1E40AF]">
                        Attached Configurator Specification
                      </div>
                      <div className="text-sm font-semibold text-[#141413] mt-0.5">
                        {appliedSpec.quantity}× {appliedSpec.modelName} · {appliedSpec.finishName}
                      </div>
                      <div className="text-xs text-[#575652] font-mono tabular-nums mt-0.5">
                        -{appliedSpec.ratingDb} dB Glazing · Est. $
                        {appliedSpec.estimatedTotalUsd.toLocaleString()}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={onClearSpec}
                      aria-label="Remove attached specification"
                      className="w-8 h-8 inline-flex items-center justify-center rounded-md text-[#575652] hover:bg-neutral-100 hover:text-[#141413] shrink-0 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="quote-name"
                      className="block text-xs font-medium text-[#141413] mb-1.5"
                    >
                      Full Name
                    </label>
                    <input
                      id="quote-name"
                      type="text"
                      value={values.fullName}
                      onChange={(e) => {
                        setValues({...values, fullName: e.target.value});
                        if (errors.fullName) setErrors({...errors, fullName: undefined});
                      }}
                      placeholder="Clara Lindqvist"
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-neutral-300 rounded-lg text-[#141413] placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E40AF]"
                    />
                    {errors.fullName && (
                      <p className="mt-1.5 flex items-center gap-1 text-xs text-red-700">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>{errors.fullName}</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="quote-email"
                      className="block text-xs font-medium text-[#141413] mb-1.5"
                    >
                      Work Email
                    </label>
                    <input
                      id="quote-email"
                      type="email"
                      value={values.workEmail}
                      onChange={(e) => {
                        setValues({...values, workEmail: e.target.value});
                        if (errors.workEmail) setErrors({...errors, workEmail: undefined});
                      }}
                      placeholder="clara@studio.com"
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-neutral-300 rounded-lg text-[#141413] placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E40AF]"
                    />
                    {errors.workEmail && (
                      <p className="mt-1.5 flex items-center gap-1 text-xs text-red-700">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>{errors.workEmail}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="quote-company"
                      className="block text-xs font-medium text-[#141413] mb-1.5"
                    >
                      Company or Architecture Firm
                    </label>
                    <input
                      id="quote-company"
                      type="text"
                      value={values.company}
                      onChange={(e) => {
                        setValues({...values, company: e.target.value});
                        if (errors.company) setErrors({...errors, company: undefined});
                      }}
                      placeholder="Nordic Partners AG"
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-neutral-300 rounded-lg text-[#141413] placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E40AF]"
                    />
                    {errors.company && (
                      <p className="mt-1.5 flex items-center gap-1 text-xs text-red-700">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>{errors.company}</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="quote-city"
                      className="block text-xs font-medium text-[#141413] mb-1.5"
                    >
                      Installation City
                    </label>
                    <input
                      id="quote-city"
                      type="text"
                      value={values.city}
                      onChange={(e) => {
                        setValues({...values, city: e.target.value});
                        if (errors.city) setErrors({...errors, city: undefined});
                      }}
                      placeholder="Seattle, WA"
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-neutral-300 rounded-lg text-[#141413] placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E40AF]"
                    />
                    {errors.city && (
                      <p className="mt-1.5 flex items-center gap-1 text-xs text-red-700">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>{errors.city}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="quote-timeline"
                    className="block text-xs font-medium text-[#141413] mb-1.5"
                  >
                    Target Installation Window
                  </label>
                  <select
                    id="quote-timeline"
                    value={values.timeline}
                    onChange={(e) => setValues({...values, timeline: e.target.value})}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-neutral-300 rounded-lg text-[#141413] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E40AF]"
                  >
                    <option value="Within 30 days">Within 30 days (Stock configurations)</option>
                    <option value="Within 60 days">Within 60 days</option>
                    <option value="Q2 / Q3 Fit-out">Q2 / Q3 Architectural Fit-out</option>
                    <option value="Specification Research">Early Specification &amp; Budgeting</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="quote-notes"
                    className="block text-xs font-medium text-[#141413] mb-1.5"
                  >
                    Floorplate or Freight Notes (Optional)
                  </label>
                  <textarea
                    id="quote-notes"
                    rows={3}
                    value={values.notes}
                    onChange={(e) => setValues({...values, notes: e.target.value})}
                    placeholder="Freight elevator dimensions, ceiling clearance, or sprinkler pass-through needs..."
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-neutral-300 rounded-lg text-[#141413] placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E40AF]"
                  />
                </div>

                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <p className="text-xs text-[#575652]">
                    CAD blocks (DWG &amp; Revit) included with every quote.
                  </p>
                  <button
                    type="submit"
                    className="px-6 py-3 text-sm font-medium text-white bg-[#1E40AF] hover:bg-[#1E3A8A] rounded-lg transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E40AF] focus-visible:ring-offset-2"
                  >
                    Send Specification Request
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
