import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Lightbulb, Mail, MessageCircle, Wrench } from 'lucide-react';

export type FeedbackIssueType = 'error' | 'bug' | 'suggestion';

interface ToolFeedbackBoxProps {
  /** Exact name of the current tool (e.g. "Invoice to Excel Converter"), or undefined on directory pages */
  toolName?: string;
  /** Optional catalog code (e.g. "TX-03") */
  toolCode?: string;
}

const WHATSAPP_NUMBER = '917795836605';
const SUPPORT_EMAIL = 'kaushik.bangera@myyahoo.com';
const DEVELOPER_EMAIL = 'arjun.bangera@yahoo.com';

const ISSUE_TYPES: {
  id: FeedbackIssueType;
  label: string;
  Icon: typeof AlertTriangle;
}[] = [
  { id: 'error', label: 'Tool Not Working / Error', Icon: AlertTriangle },
  { id: 'bug', label: 'Wrong Output / Bug', Icon: Wrench },
  { id: 'suggestion', label: 'Suggestion / New Feature', Icon: Lightbulb },
];

export function ToolFeedbackBox({ toolName, toolCode }: ToolFeedbackBoxProps) {
  const [issueType, setIssueType] = useState<FeedbackIssueType>('error');
  const [customText, setCustomText] = useState('');

  useEffect(() => {
    setCustomText('');
  }, [toolName, toolCode]);

  const handleSelectType = (nextType: FeedbackIssueType) => {
    setIssueType(nextType);
  };

  const selectedMeta = ISSUE_TYPES.find((item) => item.id === issueType) ?? ISSUE_TYPES[0];
  const targetLabel = toolName
    ? toolCode
      ? `[${toolCode}] ${toolName}`
      : toolName
    : 'VCPL Tools';

  const whatsappHref = useMemo(() => {
    const trimmed = customText.trim();
    if (!trimmed) {
      return `https://wa.me/${WHATSAPP_NUMBER}`;
    }
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(trimmed)}`;
  }, [customText]);

  const emailHref = useMemo(() => {
    const subject = `[VCPL Tools] ${selectedMeta.label} — ${targetLabel}`;
    const body = [
      `Hi Kaushik,`,
      ``,
      `Tool: ${targetLabel}`,
      `Type: ${selectedMeta.label}`,
      `Details:`,
      customText.trim(),
      ``,
    ].join('\n');

    return `mailto:${SUPPORT_EMAIL}?cc=${encodeURIComponent(DEVELOPER_EMAIL)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
      body
    )}`;
  }, [customText, selectedMeta.label, targetLabel]);

  return (
    <aside
      aria-label="Report an error or send a tool suggestion"
      className="w-full bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-4 sm:p-5 shadow-[0_3px_0_#2F3E4E] no-print"
    >
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div className="space-y-2.5 flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-display font-extrabold text-[#2F3E4E]">
              <MessageCircle className="w-4 h-4 text-[#12805C]" aria-hidden="true" />
              <span>Tool Not Working, Found an Error, or Have a Suggestion?</span>
            </span>
            {toolName && (
              <span className="font-mono text-[11px] font-bold bg-[#FEF2C8] border border-[#2F3E4E]/35 text-[#2F3E4E] px-2 py-0.5 rounded-md">
                {targetLabel}
              </span>
            )}
          </div>

          {/* Issue / Suggestion Type Selector */}
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Feedback Type">
            {ISSUE_TYPES.map(({ id, label, Icon }) => {
              const active = issueType === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleSelectType(id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-[#2F3E4E] text-[#F9C80E] border-[#2F3E4E]'
                      : 'bg-[#FEF2C8]/70 text-[#2F3E4E] border-[#2F3E4E]/30 hover:bg-[#FEF2C8]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          {/* Optional Message Input */}
          <div>
            <label htmlFor={`tool-feedback-msg-${toolCode ?? 'dir'}`} className="sr-only">
              Describe the error, issue, or suggestion
            </label>
            <textarea
              id={`tool-feedback-msg-${toolCode ?? 'dir'}`}
              rows={2}
              value={customText}
              onChange={(e) => {
                setCustomText(e.target.value);
              }}
              placeholder={`Write error details or suggestion for ${targetLabel}...`}
              className="w-full px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white text-xs sm:text-sm text-[#2F3E4E] placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#2F3E4E] resize-y"
            />
          </div>
        </div>

        {/* Direct Send Actions: WhatsApp & Email */}
        <div className="flex flex-col sm:flex-row lg:flex-col items-stretch gap-2 shrink-0 lg:w-52 lg:pt-7">
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 lg:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-[#CEE5DC] hover:bg-[#F9C80E] border-[1.5px] border-[#2F3E4E] shadow-[0_2px_0_#2F3E4E] text-xs font-display font-extrabold text-[#2F3E4E] transition-colors whitespace-nowrap"
          >
            <MessageCircle className="w-4 h-4 text-[#12805C] shrink-0" aria-hidden="true" />
            <span>Send on WhatsApp</span>
          </a>

          <a
            href={emailHref}
            className="flex-1 lg:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-[#2F3E4E] hover:bg-[#1E293B] border-[1.5px] border-[#2F3E4E] shadow-[0_2px_0_#1E293B] text-xs font-display font-extrabold text-[#FFFDF5] transition-colors whitespace-nowrap"
          >
            <Mail className="w-4 h-4 text-[#F9C80E] shrink-0" aria-hidden="true" />
            <span>Send via Email</span>
          </a>

          <p className="hidden lg:block text-[10px] text-[#64748B] text-center font-mono">
            WhatsApp: 7795836605
          </p>
        </div>
      </div>
    </aside>
  );
}
