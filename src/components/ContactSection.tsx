import { FormEvent, useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';

interface ContactSectionProps {
  preselectedDiscipline?: string;
}

const DISCIPLINES = [
  'Industrial Hardware',
  'Spatial Architecture',
  'Embedded Interfaces',
  'Material & Tooling System',
];

const TIMELINES = ['Q1–Q2 2027', 'Immediate (Within 30 Days)', 'Exploratory / 6+ Months'];

export function ContactSection({ preselectedDiscipline }: ContactSectionProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [discipline, setDiscipline] = useState(DISCIPLINES[0]);
  const [timeline, setTimeline] = useState(TIMELINES[0]);
  const [brief, setBrief] = useState('');
  const [errors, setErrors] = useState<{ name?: string; email?: string; brief?: string }>({});
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (preselectedDiscipline) {
      const match = DISCIPLINES.find((d) =>
        d.toLowerCase().includes(preselectedDiscipline.toLowerCase()),
      );
      if (match) {
        setDiscipline(match);
      }
      setSubmitted(false);
    }
  }, [preselectedDiscipline]);

  const validate = () => {
    const nextErrors: { name?: string; email?: string; brief?: string } = {};
    if (!name.trim()) {
      nextErrors.name = 'Please enter your full name.';
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = 'Please enter a valid work email address.';
    }
    if (brief.trim().length < 15) {
      nextErrors.brief = 'Please summarize your product or spatial scope (at least 15 characters).';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!validate()) return;
    setSubmitted(true);
  };

  const handleReset = () => {
    setName('');
    setEmail('');
    setBrief('');
    setErrors({});
    setSubmitted(false);
  };

  return (
    <section id="contact" className="py-16 lg:py-24">
      <div className="max-w-[1280px] mx-auto px-6 lg:px-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Left Studio Details */}
          <div className="lg:col-span-5 space-y-6">
            <div>
              <p className="text-xs font-medium text-[#5C6068] mb-3">Commission &amp; Scope</p>
              <h2 className="font-display text-2xl sm:text-3xl lg:text-[34px] font-semibold tracking-tight leading-[1.16] text-[#111214] text-balance">
                Begin a technical discovery review.
              </h2>
              <p className="mt-4 text-[15px] leading-[1.65] text-[#4A4E57] max-w-[44ch]">
                Share your engineering requirements, target production volume, or exhibition schedule. Our partners respond within two business days with a tailored feasibility outline.
              </p>
            </div>

            <div className="pt-6 border-t border-[#111214]/10 grid grid-cols-2 gap-6 text-sm">
              <div>
                <p className="font-semibold text-[#111214]">Zurich Studio</p>
                <p className="text-[#5C6068] mt-1">Talstrasse 82</p>
                <p className="text-[#5C6068]">8001 Zürich, Switzerland</p>
              </div>
              <div>
                <p className="font-semibold text-[#111214]">Kyoto Workshop</p>
                <p className="text-[#5C6068] mt-1">Nakagyo-ku, Sanjo</p>
                <p className="text-[#5C6068]">Kyoto 604-8006, Japan</p>
              </div>
            </div>
          </div>

          {/* Right Form Container */}
          <div className="lg:col-span-7 bg-white border border-[#111214]/10 rounded-xl p-6 sm:p-8">
            {submitted ? (
              <div className="py-6 space-y-4">
                <div className="inline-flex items-center gap-2.5 text-[#15803D]">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="text-sm font-semibold">Discovery Brief Logged</span>
                </div>
                <h3 className="font-display text-xl font-semibold text-[#111214]">
                  Thank you, {name}.
                </h3>
                <p className="text-sm leading-relaxed text-[#4A4E57] max-w-[52ch]">
                  Your inquiry for <span className="font-medium text-[#111214]">{discipline}</span> ({timeline}) has been prepared for review. Our lead industrial partner will reach out to <span className="font-medium text-[#111214]">{email}</span> within 48 hours.
                </p>
                <div className="pt-3">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="px-4 py-2 text-xs font-medium text-[#111214] border border-[#111214]/15 rounded-lg hover:border-[#111214]/35 transition-colors cursor-pointer"
                  >
                    Submit Another Inquiry
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label
                      htmlFor="contact-name"
                      className="block text-xs font-medium text-[#111214] mb-1.5"
                    >
                      Full Name
                    </label>
                    <input
                      id="contact-name"
                      type="text"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                      }}
                      placeholder="Clara Lindqvist"
                      className="w-full px-3.5 py-2.5 text-sm bg-[#F7F7F5] border border-[#111214]/15 rounded-lg text-[#111214] placeholder:text-[#8A8E96] focus:outline-none focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/15"
                    />
                    {errors.name && (
                      <p className="mt-1.5 text-xs text-[#B91C1C]" role="alert">
                        {errors.name}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="contact-email"
                      className="block text-xs font-medium text-[#111214] mb-1.5"
                    >
                      Work Email
                    </label>
                    <input
                      id="contact-email"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                      }}
                      placeholder="clara@company.ch"
                      className="w-full px-3.5 py-2.5 text-sm bg-[#F7F7F5] border border-[#111214]/15 rounded-lg text-[#111214] placeholder:text-[#8A8E96] focus:outline-none focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/15"
                    />
                    {errors.email && (
                      <p className="mt-1.5 text-xs text-[#B91C1C]" role="alert">
                        {errors.email}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label
                      htmlFor="contact-discipline"
                      className="block text-xs font-medium text-[#111214] mb-1.5"
                    >
                      Primary Discipline
                    </label>
                    <select
                      id="contact-discipline"
                      value={discipline}
                      onChange={(e) => setDiscipline(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-[#F7F7F5] border border-[#111214]/15 rounded-lg text-[#111214] focus:outline-none focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/15"
                    >
                      {DISCIPLINES.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="contact-timeline"
                      className="block text-xs font-medium text-[#111214] mb-1.5"
                    >
                      Target Kickoff
                    </label>
                    <select
                      id="contact-timeline"
                      value={timeline}
                      onChange={(e) => setTimeline(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-[#F7F7F5] border border-[#111214]/15 rounded-lg text-[#111214] focus:outline-none focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/15"
                    >
                      {TIMELINES.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="contact-brief"
                    className="block text-xs font-medium text-[#111214] mb-1.5"
                  >
                    Project Scope &amp; Constraints
                  </label>
                  <textarea
                    id="contact-brief"
                    rows={4}
                    value={brief}
                    onChange={(e) => {
                      setBrief(e.target.value);
                      if (errors.brief) setErrors((prev) => ({ ...prev, brief: undefined }));
                    }}
                    placeholder="Outline target enclosure materials, volume expectations, or architectural site location..."
                    className="w-full px-3.5 py-2.5 text-sm bg-[#F7F7F5] border border-[#111214]/15 rounded-lg text-[#111214] placeholder:text-[#8A8E96] focus:outline-none focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/15 resize-y"
                  />
                  {errors.brief && (
                    <p className="mt-1.5 text-xs text-[#B91C1C]" role="alert">
                      {errors.brief}
                    </p>
                  )}
                </div>

                <div className="pt-1 flex items-center justify-between gap-4">
                  <p className="text-xs text-[#5C6068]">
                    Mutual NDA provided prior to CAD transfer.
                  </p>
                  <button
                    type="submit"
                    className="px-5 py-2.5 text-sm font-semibold text-white bg-[#1D4ED8] hover:bg-[#1E40AF] rounded-lg transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8]"
                  >
                    Send Discovery Brief
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
