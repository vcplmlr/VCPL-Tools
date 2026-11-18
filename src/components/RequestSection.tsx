import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Lightbulb,
  Mail,
  MessageCircle,
  Wrench,
} from 'lucide-react';

type SuggestionKind = 'new-tool' | 'not-working' | 'bug-fix' | 'format-request';

const WHATSAPP_NUMBER = '917795836605';
const ARJUN_EMAIL = 'arjun.bangera@yahoo.com';
const KAUSHIK_EMAIL = 'kaushik.bangera@myyahoo.com';

const SUGGESTION_TYPES: {
  id: SuggestionKind;
  label: string;
  Icon: typeof Lightbulb;
}[] = [
  {
    id: 'new-tool',
    label: 'New Tool Request',
    Icon: Lightbulb,
  },
  {
    id: 'not-working',
    label: 'Tool Not Working / Error',
    Icon: AlertTriangle,
  },
  {
    id: 'bug-fix',
    label: 'Bug / Wrong Output',
    Icon: Wrench,
  },
  {
    id: 'format-request',
    label: 'Bank Slip / GST Format',
    Icon: FileSpreadsheet,
  },
];

export function RequestSection() {
  const [suggestionType, setSuggestionType] = useState<SuggestionKind>('new-tool');
  const [toolName, setToolName] = useState('');
  const [customDetails, setCustomDetails] = useState('');
  const [senderContact, setSenderContact] = useState('');
  const [sentVia, setSentVia] = useState<'whatsapp' | 'email' | null>(null);

  const selectedMeta =
    SUGGESTION_TYPES.find((item) => item.id === suggestionType) ?? SUGGESTION_TYPES[0];

  const handleTypeChange = (nextKind: SuggestionKind) => {
    setSuggestionType(nextKind);
  };

  const whatsappHref = useMemo(() => {
    const lines = [
      toolName.trim(),
      customDetails.trim(),
      senderContact.trim() ? `From: ${senderContact.trim()}` : '',
    ].filter(Boolean);
    if (lines.length === 0) {
      return `https://wa.me/${WHATSAPP_NUMBER}`;
    }
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join('\n'))}`;
  }, [customDetails, senderContact, toolName]);

  const emailHref = useMemo(() => {
    const subject = `[VCPL Tools] ${selectedMeta.label}${
      toolName.trim() ? `: ${toolName.trim()}` : ''
    }`;
    const bodyLines = [
      `Hi Kaushik,`,
      ``,
      `Type: ${selectedMeta.label}`,
      `Tool / Subject: ${toolName.trim() || 'VCPL Tools General'}`,
      `Details:`,
      customDetails.trim(),
    ];
    if (senderContact.trim()) {
      bodyLines.push('', `Contact / Email: ${senderContact.trim()}`);
    }
    return `mailto:${KAUSHIK_EMAIL}?cc=${encodeURIComponent(ARJUN_EMAIL)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
      bodyLines.join('\n')
    )}`;
  }, [customDetails, selectedMeta.label, senderContact, toolName]);

  return (
    <section
      id="request-tool"
      className="w-full bg-[#FEF2C8] dark:bg-[#0B1120] py-16 md:py-20 border-t border-[#2F3E4E]/10 dark:border-slate-800 no-print transition-colors duration-200"
    >
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6">
        <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-6 sm:p-8 md:p-10 shadow-[0_5px_0_#2F3E4E] dark:shadow-[0_5px_0_#020617]">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Intro & Direct Contact Summary */}
            <div className="lg:col-span-5 space-y-4">
              <h2 className="font-display font-extrabold text-2xl md:text-[28px] text-[#2F3E4E] dark:text-slate-50 tracking-tight [text-wrap:balance]">
                Suggest a Module or Report an Issue
              </h2>
              <p className="text-[15px] leading-relaxed text-[#475569] dark:text-slate-300">
                Need another bank slip layout, tax calculator, or spotted an error in any tool?
                Pick a type, write your details, and send directly via WhatsApp or Email.
              </p>

              <div className="space-y-2 pt-1 text-xs font-semibold text-[#2F3E4E] dark:text-slate-200">
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-[#12805C] dark:text-emerald-400 shrink-0" aria-hidden="true" />
                  <span>
                    WhatsApp Direct:{' '}
                    <a
                      href={`https://wa.me/${WHATSAPP_NUMBER}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono font-bold underline underline-offset-2 hover:text-[#12805C] dark:hover:text-emerald-400"
                    >
                      +91 7795836605
                    </a>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-[#2F3E4E] dark:text-slate-400 shrink-0" aria-hidden="true" />
                  <span>
                    <a
                      href={`mailto:${ARJUN_EMAIL}`}
                      className="font-bold underline underline-offset-2 hover:text-[#1D4ED8] dark:hover:text-[#F9C80E]"
                    >
                      Arjun Bangera
                    </a>
                    :{' '}
                    <a
                      href={`mailto:${ARJUN_EMAIL}`}
                      className="font-mono font-bold underline underline-offset-2 hover:text-[#1D4ED8] dark:hover:text-[#F9C80E] break-all"
                    >
                      {ARJUN_EMAIL}
                    </a>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-[#2F3E4E] dark:text-slate-400 shrink-0" aria-hidden="true" />
                  <span>
                    <a
                      href={`mailto:${KAUSHIK_EMAIL}`}
                      className="font-bold underline underline-offset-2 hover:text-[#1D4ED8] dark:hover:text-[#F9C80E]"
                    >
                      Kaushik Bangera
                    </a>
                    :{' '}
                    <a
                      href={`mailto:${KAUSHIK_EMAIL}`}
                      className="font-mono font-bold underline underline-offset-2 hover:text-[#1D4ED8] dark:hover:text-[#F9C80E] break-all"
                    >
                      {KAUSHIK_EMAIL}
                    </a>
                  </span>
                </div>
              </div>

              {sentVia && (
                <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#CEE5DC] dark:bg-emerald-950/70 border border-[#2F3E4E]/40 dark:border-emerald-500/40 text-xs font-bold text-[#2F3E4E] dark:text-emerald-200">
                  <CheckCircle2 className="w-4 h-4 text-[#12805C] dark:text-emerald-400 shrink-0" aria-hidden="true" />
                  <span>
                    Opened {sentVia === 'whatsapp' ? 'WhatsApp chat' : 'Email draft'}.
                  </span>
                </div>
              )}
            </div>

            {/* Right Interactive Suggestion / Issue Composer */}
            <div className="lg:col-span-7 space-y-4">
              {/* Suggestion Type Selector */}
              <div className="space-y-1.5">
                <span className="block text-xs font-display font-extrabold uppercase tracking-wider text-[#475569] dark:text-slate-400">
                  1. Select Suggestion or Issue Type
                </span>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Suggestion Type">
                  {SUGGESTION_TYPES.map(({ id, label, Icon }) => {
                    const active = suggestionType === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => handleTypeChange(id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border-[1.5px] transition-colors cursor-pointer whitespace-nowrap ${
                          active
                            ? 'bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#F9C80E] dark:text-[#0F172A] border-[#2F3E4E] dark:border-[#F9C80E]'
                            : 'bg-[#FEF2C8]/75 dark:bg-slate-800 text-[#2F3E4E] dark:text-slate-200 border-[#2F3E4E]/35 dark:border-slate-600 hover:bg-[#FEF2C8] dark:hover:bg-slate-700'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tool Name + Optional Sender Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="req-tool-name" className="sr-only">
                    Tool or Module Name
                  </label>
                  <input
                    id="req-tool-name"
                    type="text"
                    value={toolName}
                    onChange={(e) => setToolName(e.target.value)}
                    placeholder="Tool name (e.g. ICICI Slip, Invoice PDF...)"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#0B1120] border-[1.5px] border-[#2F3E4E] dark:border-slate-600 text-sm text-[#2F3E4E] dark:text-slate-100 placeholder:text-[#64748B] dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#2F3E4E] dark:focus:ring-[#F9C80E]"
                  />
                </div>

                <div>
                  <label htmlFor="req-sender-contact" className="sr-only">
                    Your Name or Email (optional)
                  </label>
                  <input
                    id="req-sender-contact"
                    type="text"
                    value={senderContact}
                    onChange={(e) => setSenderContact(e.target.value)}
                    placeholder="Your name or email (optional)"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#0B1120] border-[1.5px] border-[#2F3E4E] dark:border-slate-600 text-sm text-[#2F3E4E] dark:text-slate-100 placeholder:text-[#64748B] dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#2F3E4E] dark:focus:ring-[#F9C80E]"
                  />
                </div>
              </div>

              {/* Custom Prefilled Message Textarea */}
              <div>
                <label htmlFor="req-custom-details" className="sr-only">
                  Custom suggestion or error details
                </label>
                <textarea
                  id="req-custom-details"
                  rows={3}
                  value={customDetails}
                  onChange={(e) => {
                    setCustomDetails(e.target.value);
                  }}
                  placeholder="Write your suggestion, error message, or custom details..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#0B1120] border-[1.5px] border-[#2F3E4E] dark:border-slate-600 text-sm text-[#2F3E4E] dark:text-slate-100 placeholder:text-[#64748B] dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#2F3E4E] dark:focus:ring-[#F9C80E] resize-y"
                />
              </div>

              {/* Direct Send Buttons: WhatsApp & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setSentVia('whatsapp')}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#CEE5DC] dark:bg-emerald-950/75 hover:bg-[#F9C80E] dark:hover:bg-[#F9C80E] border-[1.5px] border-[#2F3E4E] dark:border-emerald-500/50 dark:hover:border-[#F9C80E] shadow-[0_3px_0_#2F3E4E] dark:shadow-[0_3px_0_#020617] text-sm font-display font-extrabold text-[#2F3E4E] dark:text-emerald-200 dark:hover:text-[#0F172A] transition-all hover:-translate-y-0.5 whitespace-nowrap"
                >
                  <MessageCircle className="w-4 h-4 text-[#12805C] dark:text-current shrink-0" aria-hidden="true" />
                  <span>Send via WhatsApp</span>
                </a>

                <a
                  href={emailHref}
                  onClick={() => setSentVia('email')}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#2F3E4E] dark:bg-[#F9C80E] hover:bg-[#1E293B] dark:hover:bg-[#FDE047] border-[1.5px] border-[#2F3E4E] dark:border-[#F9C80E] shadow-[0_3px_0_#1E293B] dark:shadow-[0_3px_0_#020617] text-sm font-display font-extrabold text-[#FFFDF5] dark:text-[#0F172A] transition-all hover:-translate-y-0.5 whitespace-nowrap"
                >
                  <Mail className="w-4 h-4 text-[#F9C80E] dark:text-[#0F172A] shrink-0" aria-hidden="true" />
                  <span>Send via Email</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

