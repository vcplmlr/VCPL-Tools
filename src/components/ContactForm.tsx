import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';

interface ContactFormProps {
  preselectedScope: string;
  preselectedNote: string;
  focusTrigger: number;
}

interface FormErrors {
  name?: string;
  email?: string;
  notes?: string;
}

const SCOPE_OPTIONS = [
  'Acoustic Timber',
  'Structural Glass',
  'Modular Metal',
  'Full-Scale Mockup',
];

export function ContactForm({
  preselectedScope,
  preselectedNote,
  focusTrigger,
}: ContactFormProps) {
  const nameInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [organization, setOrganization] = useState('');
  const [scope, setScope] = useState(preselectedScope || SCOPE_OPTIONS[0]);
  const [notes, setNotes] = useState(preselectedNote || '');
  const [errors, setErrors] = useState<FormErrors>({});
  const [submittedData, setSubmittedData] = useState<{
    name: string;
    email: string;
    scope: string;
  } | null>(null);

  useEffect(() => {
    if (preselectedScope) {
      setScope(preselectedScope);
    }
  }, [preselectedScope]);

  useEffect(() => {
    if (preselectedNote) {
      setNotes(preselectedNote);
    }
  }, [preselectedNote]);

  useEffect(() => {
    if (focusTrigger > 0) {
      nameInputRef.current?.focus();
    }
  }, [focusTrigger]);

  const validate = (): FormErrors => {
    const nextErrors: FormErrors = {};
    if (name.trim().length < 2) {
      nextErrors.name = 'Please enter your full name (at least 2 characters).';
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email.trim())) {
      nextErrors.email = 'Please provide a valid work email address.';
    }
    if (notes.trim().length < 12) {
      nextErrors.notes = 'Please include a brief summary of dimensions or schedule (min. 12 characters).';
    }
    return nextErrors;
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setSubmittedData({
      name: name.trim(),
      email: email.trim(),
      scope,
    });
  };

  const handleReset = () => {
    setSubmittedData(null);
    setName('');
    setEmail('');
    setOrganization('');
    setNotes('');
    setErrors({});
  };

  if (submittedData) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="bg-white border border-slate-200 rounded-xl p-8 space-y-5"
      >
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
          <div className="space-y-1.5">
            <h3 className="font-[family-name:var(--font-display)] text-xl font-semibold text-slate-900">
              Project brief received
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Thank you, {submittedData.name}. An engineering estimator for{' '}
              <span className="font-medium text-slate-900">{submittedData.scope}</span>{' '}
              will reply to <span className="font-medium text-slate-900">{submittedData.email}</span>{' '}
              within one business day with preliminary lead times.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="px-4 py-2 min-h-[40px] text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
        >
          Send Another Inquiry
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-5"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label
            htmlFor="contact-name"
            className="block text-sm font-medium text-slate-900 mb-1.5"
          >
            Full Name
          </label>
          <input
            ref={nameInputRef}
            id="contact-name"
            type="text"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
            }}
            placeholder="Elena Vance"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? 'contact-name-error' : undefined}
            className={`w-full px-3.5 py-2.5 min-h-[44px] text-sm text-slate-900 bg-white border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-700 ${
              errors.name ? 'border-red-600' : 'border-slate-300'
            }`}
          />
          {errors.name && (
            <p
              id="contact-name-error"
              className="mt-1.5 flex items-center gap-1.5 text-xs text-red-700"
            >
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errors.name}</span>
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="contact-email"
            className="block text-sm font-medium text-slate-900 mb-1.5"
          >
            Work Email
          </label>
          <input
            id="contact-email"
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
            }}
            placeholder="elena@studio-example.com"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'contact-email-error' : undefined}
            className={`w-full px-3.5 py-2.5 min-h-[44px] text-sm text-slate-900 bg-white border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-700 ${
              errors.email ? 'border-red-600' : 'border-slate-300'
            }`}
          />
          {errors.email && (
            <p
              id="contact-email-error"
              className="mt-1.5 flex items-center gap-1.5 text-xs text-red-700"
            >
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errors.email}</span>
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label
            htmlFor="contact-organization"
            className="block text-sm font-medium text-slate-900 mb-1.5"
          >
            Firm or Organization
          </label>
          <input
            id="contact-organization"
            type="text"
            value={organization}
            onChange={(event) => setOrganization(event.target.value)}
            placeholder="Optional"
            className="w-full px-3.5 py-2.5 min-h-[44px] text-sm text-slate-900 bg-white border border-slate-300 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-700"
          />
        </div>

        <div>
          <label
            htmlFor="contact-scope"
            className="block text-sm font-medium text-slate-900 mb-1.5"
          >
            Primary Scope
          </label>
          <select
            id="contact-scope"
            value={scope}
            onChange={(event) => setScope(event.target.value)}
            className="w-full px-3.5 py-2.5 min-h-[44px] text-sm text-slate-900 bg-white border border-slate-300 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-700"
          >
            {SCOPE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label
          htmlFor="contact-notes"
          className="block text-sm font-medium text-slate-900 mb-1.5"
        >
          Project Summary &amp; Target Schedule
        </label>
        <textarea
          id="contact-notes"
          rows={4}
          value={notes}
          onChange={(event) => {
            setNotes(event.target.value);
            if (errors.notes) setErrors((prev) => ({ ...prev, notes: undefined }));
          }}
          placeholder="Approximate square meters, site location, and target installation quarter."
          aria-invalid={Boolean(errors.notes)}
          aria-describedby={errors.notes ? 'contact-notes-error' : undefined}
          className={`w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-700 ${
            errors.notes ? 'border-red-600' : 'border-slate-300'
          }`}
        />
        {errors.notes && (
          <p
            id="contact-notes-error"
            className="mt-1.5 flex items-center gap-1.5 text-xs text-red-700"
          >
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{errors.notes}</span>
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
        <p className="text-xs text-slate-500">
          Direct engineering review in Zurich or Portland. No mailing list signup.
        </p>
        <button
          type="submit"
          className="px-5 py-2.5 min-h-[44px] text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors duration-150 cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2"
        >
          Schedule Discovery Call
        </button>
      </div>
    </form>
  );
}
