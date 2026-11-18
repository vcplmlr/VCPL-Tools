import { FormEvent, RefObject, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';

interface RequestDemoSectionProps {
  nameInputRef: RefObject<HTMLInputElement | null>;
}

interface FormState {
  fullName: string;
  workEmail: string;
  company: string;
  bayCount: string;
  focusArea: string;
  notes: string;
}

interface FormErrors {
  fullName?: string;
  workEmail?: string;
  company?: string;
}

const INITIAL_FORM: FormState = {
  fullName: '',
  workEmail: '',
  company: '',
  bayCount: '15–40 dock bays',
  focusArea: 'Yard & Dock Scheduling',
  notes: '',
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function RequestDemoSection({ nameInputRef }: RequestDemoSectionProps) {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submittedRecord, setSubmittedRecord] = useState<FormState | null>(null);

  const validate = (): FormErrors => {
    const nextErrors: FormErrors = {};
    if (form.fullName.trim().length < 2) {
      nextErrors.fullName = 'Enter your full name.';
    }
    if (!EMAIL_REGEX.test(form.workEmail.trim())) {
      nextErrors.workEmail = 'Enter a valid work email address.';
    }
    if (form.company.trim().length < 2) {
      nextErrors.company = 'Enter your company or facility name.';
    }
    return nextErrors;
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});
    setSubmittedRecord(form);
  };

  const handleReset = () => {
    setForm(INITIAL_FORM);
    setErrors({});
    setSubmittedRecord(null);
  };

  return (
    <section id="request-demo" className="py-16 lg:py-20 bg-white border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
          <div className="lg:col-span-5">
            <p className="text-sm font-medium text-blue-800 mb-2">Live Engineering Walkthrough</p>
            <h2
              className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900"
              style={{ textWrap: 'balance' }}
            >
              Schedule a 25-minute facility walkthrough.
            </h2>
            <p className="mt-3 text-base text-slate-600 leading-relaxed">
              Meet directly with a solutions engineer to map your yard layout, existing WMS or EDI
              feeds, and thermal compliance reporting requirements.
            </p>

            <ol className="mt-8 space-y-4 border-t border-slate-200 pt-6 text-sm text-slate-700">
              <li className="flex gap-3">
                <span className="font-mono text-xs font-semibold text-blue-800 pt-0.5">01.</span>
                <span>Review your current gate-to-bay dwell bottlenecks and shift peak hours.</span>
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-xs font-semibold text-blue-800 pt-0.5">02.</span>
                <span>Walk through live EDI 214, reefer telemetry, and SMS driver routing.</span>
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-xs font-semibold text-blue-800 pt-0.5">03.</span>
                <span>Receive a hardware-light rollout timeline tailored to your dock count.</span>
              </li>
            </ol>
          </div>

          <div className="lg:col-span-7">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 sm:p-8">
              {submittedRecord ? (
                <div className="py-6">
                  <div className="inline-flex items-center gap-2 text-blue-900 font-semibold text-base">
                    <CheckCircle2 className="w-5 h-5 text-blue-800 shrink-0" aria-hidden="true" />
                    <span>Walkthrough Request Confirmed</span>
                  </div>

                  <p className="mt-3 text-sm text-slate-700 leading-relaxed">
                    Thank you, <span className="font-semibold">{submittedRecord.fullName}</span>. A
                    solutions engineer will email{' '}
                    <span className="font-mono text-xs font-medium text-slate-900">
                      {submittedRecord.workEmail}
                    </span>{' '}
                    within one business day with proposed calendar windows for{' '}
                    <span className="font-semibold">{submittedRecord.company}</span>.
                  </p>

                  <dl className="mt-6 pt-5 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <dt className="text-slate-500">Facility Scale</dt>
                      <dd className="font-semibold text-slate-900 mt-0.5">
                        {submittedRecord.bayCount}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Primary Focus</dt>
                      <dd className="font-semibold text-slate-900 mt-0.5">
                        {submittedRecord.focusArea}
                      </dd>
                    </div>
                  </dl>

                  <button
                    type="button"
                    onClick={handleReset}
                    className="mt-6 px-4 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Submit Another Request
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} noValidate className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label
                        htmlFor="demo-full-name"
                        className="block text-xs font-semibold text-slate-700 mb-1.5"
                      >
                        Full Name
                      </label>
                      <input
                        ref={nameInputRef}
                        id="demo-full-name"
                        type="text"
                        required
                        value={form.fullName}
                        onChange={(e) => {
                          setForm({ ...form, fullName: e.target.value });
                          if (errors.fullName) setErrors({ ...errors, fullName: undefined });
                        }}
                        placeholder="Jordan Alvarez"
                        className={`w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border rounded-lg focus:outline-none focus:ring-1 ${
                          errors.fullName
                            ? 'border-red-600 focus:border-red-600 focus:ring-red-600'
                            : 'border-slate-300 focus:border-blue-800 focus:ring-blue-800'
                        }`}
                      />
                      {errors.fullName && (
                        <p className="mt-1.5 text-xs text-red-700 font-medium">{errors.fullName}</p>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="demo-work-email"
                        className="block text-xs font-semibold text-slate-700 mb-1.5"
                      >
                        Work Email
                      </label>
                      <input
                        id="demo-work-email"
                        type="email"
                        required
                        value={form.workEmail}
                        onChange={(e) => {
                          setForm({ ...form, workEmail: e.target.value });
                          if (errors.workEmail) setErrors({ ...errors, workEmail: undefined });
                        }}
                        placeholder="jordan@company.com"
                        className={`w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border rounded-lg focus:outline-none focus:ring-1 ${
                          errors.workEmail
                            ? 'border-red-600 focus:border-red-600 focus:ring-red-600'
                            : 'border-slate-300 focus:border-blue-800 focus:ring-blue-800'
                        }`}
                      />
                      {errors.workEmail && (
                        <p className="mt-1.5 text-xs text-red-700 font-medium">
                          {errors.workEmail}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label
                        htmlFor="demo-company"
                        className="block text-xs font-semibold text-slate-700 mb-1.5"
                      >
                        Company or Facility
                      </label>
                      <input
                        id="demo-company"
                        type="text"
                        required
                        value={form.company}
                        onChange={(e) => {
                          setForm({ ...form, company: e.target.value });
                          if (errors.company) setErrors({ ...errors, company: undefined });
                        }}
                        placeholder="Northwind Cold Storage"
                        className={`w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border rounded-lg focus:outline-none focus:ring-1 ${
                          errors.company
                            ? 'border-red-600 focus:border-red-600 focus:ring-red-600'
                            : 'border-slate-300 focus:border-blue-800 focus:ring-blue-800'
                        }`}
                      />
                      {errors.company && (
                        <p className="mt-1.5 text-xs text-red-700 font-medium">{errors.company}</p>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="demo-bay-count"
                        className="block text-xs font-semibold text-slate-700 mb-1.5"
                      >
                        Facility Scale
                      </label>
                      <select
                        id="demo-bay-count"
                        value={form.bayCount}
                        onChange={(e) => setForm({ ...form, bayCount: e.target.value })}
                        className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-800 focus:ring-1 focus:ring-blue-800 cursor-pointer"
                      >
                        <option value="1–14 dock bays">1–14 dock bays</option>
                        <option value="15–40 dock bays">15–40 dock bays</option>
                        <option value="41–100 dock bays">41–100 dock bays</option>
                        <option value="Multi-site network (100+ bays)">
                          Multi-site network (100+ bays)
                        </option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="demo-focus"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      Primary Operational Focus
                    </label>
                    <select
                      id="demo-focus"
                      value={form.focusArea}
                      onChange={(e) => setForm({ ...form, focusArea: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-800 focus:ring-1 focus:ring-blue-800 cursor-pointer"
                    >
                      <option value="Yard & Dock Scheduling">Yard &amp; Dock Scheduling</option>
                      <option value="Thermal Compliance & Auditing">
                        Thermal Compliance &amp; Auditing
                      </option>
                      <option value="Automated Gate Check-In">Automated Gate Check-In</option>
                      <option value="Full Platform Rollout">Full Platform Rollout</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="demo-notes"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      Operational Notes (Optional)
                    </label>
                    <textarea
                      id="demo-notes"
                      rows={3}
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      placeholder="Current WMS/TMS systems, cold-storage temperature bands, or gate volume..."
                      className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-800 focus:ring-1 focus:ring-blue-800 resize-none"
                    />
                  </div>

                  <div className="pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <p className="text-xs text-slate-500">
                      Direct engineering session. No automated sales sequences.
                    </p>
                    <button
                      type="submit"
                      className="px-6 py-3 text-sm font-semibold text-white bg-blue-800 rounded-lg hover:bg-blue-900 active:scale-[0.99] transition-all whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800 cursor-pointer"
                    >
                      Request Demo Walkthrough
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
