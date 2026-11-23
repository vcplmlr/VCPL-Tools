import { useMemo, useState } from 'react';
import { ChevronDown, HelpCircle, ShieldCheck } from 'lucide-react';
import { SITE_CONTACT } from '../data/legalPagesData';
import { PUBLIC_TOOLS_CATALOG } from '../data/toolsCatalog';

type FaqTopic = 'All' | 'Privacy & Security' | 'Banking & Tax' | 'PDF & Image' | 'General';

interface FaqItem {
  id: string;
  topic: Exclude<FaqTopic, 'All'>;
  question: string;
  answer: string;
}

const FAQ_TOPICS: FaqTopic[] = [
  'All',
  'Privacy & Security',
  'Banking & Tax',
  'PDF & Image',
  'General',
];

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'privacy-client-side',
    topic: 'Privacy & Security',
    question: 'Are my PDF, Excel, tax, and bank files uploaded to any server?',
    answer:
      'No. All file-processing tools on VCPL Tools execute 100% locally inside your web browser using client-side libraries (PDF.js, pdf-lib, SheetJS/xlsx, and HTML5 Canvas). Your invoices, Form 26AS statements, GSTR-2B files, bank slip data, and images stay strictly in your device memory and are never uploaded to or stored on our servers.',
  },
  {
    id: 'free-no-signup',
    topic: 'General',
    question: `Are all ${PUBLIC_TOOLS_CATALOG.length} tools completely free without signup or watermarks?`,
    answer: `Yes. Every one of our ${PUBLIC_TOOLS_CATALOG.length} browser utilities across Banking, Tax & GST, Calculator Hub, PDF Suite, Image Studio, Typing & Text, QR Utilities, VCPL Enterprise, Special Tools, and Learn Tools works immediately without login, paywalls, daily caps, or forced VCPL watermarks.`,
  },
  {
    id: 'official-affiliation',
    topic: 'Banking & Tax',
    question:
      'Is VCPL Tools affiliated with SBI, HDFC Bank, the Income Tax Department, GSTN, or Tally?',
    answer:
      'No. VCPL Tools is an independent productivity workspace. References to SBI, HDFC Bank, Form 26AS, TRACES, GSTR-1, GSTR-2B, or Tally are strictly for format identification and workflow compatibility. Always verify bank account details, deposit slip fields, GST figures, and tax calculations independently before filing or transacting.',
  },
  {
    id: 'supported-banks',
    topic: 'Banking & Tax',
    question: 'Which bank deposit slip formats are currently supported?',
    answer:
      'VCPL Tools currently provides dedicated printable A4 deposit slip layouts and Bulk Excel batch slip generation for State Bank of India (SBI) and HDFC Bank—covering cash denominations, cheque, and DD entries—plus a Pan-India IFSC & MICR branch directory lookup.',
  },
  {
    id: 'tax-gst-excel',
    topic: 'Banking & Tax',
    question:
      'How do PDF to Excel Convertor Form 26AS, GSTR-1 Return Prep, GSTR-2B vs Tally Reconciler, Invoice to Excel, and DMS vs Tally work?',
    answer:
      'Each tax and audit engine parses your PDF, JSON, CSV, or Excel files right inside your browser tab, normalizes GSTINs, invoice dates, taxable values, and TDS/ITC columns, and exports clean multi-sheet .xlsx audit workbooks or GST portal GSTR-1 JSON ready for Tally Prime or CA review—with zero cloud exposure.',
  },
  {
    id: 'image-transparency',
    topic: 'PDF & Image',
    question: 'Do PNG Crop, WEBP Crop, and Background Remover preserve transparency?',
    answer:
      'Yes. Transparent PNG and WEBP alpha channels are preserved cleanly throughout cropping, resizing, rotation/flipping, and background removal. When exporting to JPG (which does not support alpha transparency), you can choose a crisp white or custom solid background fill.',
  },
  {
    id: 'pdf-unlock-security',
    topic: 'PDF & Image',
    question: 'Can PDF Unlocker decrypt password-protected bank statements or e-Aadhaar PDFs?',
    answer:
      'Yes—when you supply the authorized open password, PDF Unlocker decrypts the document locally in browser memory and lets you download an unlocked copy without transmitting your password or statement over the internet. You can also apply AES-256 encryption using PDF Password Protector.',
  },
  {
    id: 'local-storage-data',
    topic: 'Privacy & Security',
    question: 'Where are my favorite tools, recent history, and invoice templates saved?',
    answer:
      'Preferences such as starred favorites, recent tool shortcuts, cookie consent state, and saved invoice header defaults are stored strictly in your own browser localStorage. You can erase all locally saved data anytime via Cookie Preferences in the footer.',
  },
  {
    id: 'support-contact',
    topic: 'General',
    question: 'How can I get help if a calculation, slip layout, or file import has an issue?',
    answer: `You can click the floating WhatsApp Support Chat icon at the bottom-left corner of any page to open WhatsApp directly with no prefilled text, or email ${SITE_CONTACT.developer} (${SITE_CONTACT.developerEmail}) / ${SITE_CONTACT.ideation} (${SITE_CONTACT.ideationEmail}).`,
  },
];

interface FaqSectionProps {
  variant?: 'home' | 'directory';
}

export function FaqSection({ variant = 'home' }: FaqSectionProps) {
  const [activeTopic, setActiveTopic] = useState<FaqTopic>('All');
  const [openId, setOpenId] = useState<string>(FAQ_ITEMS[0].id);

  const visibleFaqs = useMemo(() => {
    if (activeTopic === 'All') return FAQ_ITEMS;
    return FAQ_ITEMS.filter((item) => item.topic === activeTopic);
  }, [activeTopic]);

  const handleToggle = (id: string) => {
    setOpenId((prev) => (prev === id ? '' : id));
  };

  const innerContent = (
    <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-6 sm:p-8 md:p-10 shadow-[0_5px_0_#2F3E4E] dark:shadow-[0_5px_0_#020617] space-y-6">
      {/* Header + Topic Filter */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 pb-5 border-b border-[#2F3E4E]/15 dark:border-slate-800">
        <div className="space-y-2 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono font-bold text-[#2F3E4E] dark:text-slate-200">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#F9C80E] border border-[#2F3E4E] text-[#0F172A]">
              <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
              <span>FAQ</span>
            </span>
            <span className="inline-flex items-center gap-1 text-[#12805C] dark:text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{FAQ_ITEMS.length} Common Questions</span>
            </span>
          </div>
          <h2 className="font-display font-extrabold text-[clamp(1.6rem,3vw,2.2rem)] leading-tight text-[#2F3E4E] dark:text-slate-50 tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="text-sm text-[#475569] dark:text-slate-300 leading-relaxed">
            Clear answers about client-side privacy, SBI &amp; HDFC slip formats, GST/26AS Excel
            exports, PDF security, and browser compatibility.
          </p>
        </div>

        {/* Topic Filter Pills */}
        <div
          role="tablist"
          aria-label="Filter FAQ topics"
          className="flex flex-wrap items-center gap-2"
        >
          {FAQ_TOPICS.map((topic) => {
            const isSelected = activeTopic === topic;
            return (
              <button
                key={topic}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => {
                  setActiveTopic(topic);
                  const first =
                    topic === 'All'
                      ? FAQ_ITEMS[0]
                      : FAQ_ITEMS.find((item) => item.topic === topic);
                  if (first) setOpenId(first.id);
                }}
                className={`px-3 py-2 min-h-[38px] rounded-lg text-xs font-bold border-[1.5px] transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  isSelected
                    ? 'bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#F9C80E] dark:text-[#0F172A] border-[#2F3E4E] dark:border-[#F9C80E]'
                    : 'bg-[#FEF2C8] dark:bg-slate-800 text-[#2F3E4E] dark:text-slate-200 border-[#2F3E4E]/45 dark:border-slate-600 hover:bg-[#F9C80E] dark:hover:bg-[#F9C80E] dark:hover:text-[#0F172A]'
                }`}
              >
                {topic}
              </button>
            );
          })}
        </div>
      </div>

      {/* Accordion List */}
      <div className="space-y-3">
        {visibleFaqs.map((item, idx) => {
          const isOpen = openId === item.id;
          const panelId = `faq-panel-${item.id}`;
          const buttonId = `faq-trigger-${item.id}`;
          return (
            <div
              key={item.id}
              className={`rounded-xl border-[1.5px] transition-colors ${
                isOpen
                  ? 'border-[#2F3E4E] dark:border-[#F9C80E]/70 bg-[#FEF2C8]/65 dark:bg-[#0F172A] shadow-[0_3px_0_#2F3E4E] dark:shadow-[0_3px_0_#020617]'
                  : 'border-[#2F3E4E]/35 dark:border-slate-700 bg-white dark:bg-[#0F172A]/60 hover:border-[#2F3E4E] dark:hover:border-slate-500'
              }`}
            >
              <button
                id={buttonId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => handleToggle(item.id)}
                className="w-full px-4 sm:px-5 py-4 flex items-center justify-between gap-4 text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F3E4E] dark:focus-visible:ring-[#F9C80E] rounded-xl"
              >
                <div className="flex items-start sm:items-center gap-3 min-w-0">
                  <span className="mt-0.5 sm:mt-0 px-2 py-0.5 rounded bg-[#CEE5DC] dark:bg-emerald-500/20 border border-[#2F3E4E]/40 dark:border-emerald-400/40 text-[10px] font-mono font-extrabold text-[#2F3E4E] dark:text-emerald-300 tabular-nums shrink-0">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0">
                    <span className="block font-display font-bold text-sm sm:text-[15px] text-[#2F3E4E] dark:text-slate-100 leading-snug">
                      {item.question}
                    </span>
                    <span className="inline-block mt-0.5 text-[11px] font-semibold text-[#64748B] dark:text-slate-400">
                      {item.topic}
                    </span>
                  </div>
                </div>
                <ChevronDown
                  className={`w-4 h-4 sm:w-5 sm:h-5 text-[#2F3E4E] dark:text-slate-300 shrink-0 transition-transform duration-200 ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                  aria-hidden="true"
                />
              </button>

              {isOpen && (
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  className="px-4 sm:px-5 pb-4 pt-1 border-t border-[#2F3E4E]/10 dark:border-slate-800"
                >
                  <p className="text-xs sm:text-sm text-[#334155] dark:text-slate-300 leading-relaxed sm:pl-10">
                    {item.answer}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  if (variant === 'directory') {
    return (
      <div id="faq" className="scroll-mt-24">
        {innerContent}
      </div>
    );
  }

  return (
    <section
      id="faq"
      className="w-full bg-[#FEF2C8] dark:bg-[#0B1120] py-14 sm:py-16 md:py-20 border-t border-[#2F3E4E]/10 dark:border-slate-800 scroll-mt-24 transition-colors duration-200"
    >
      <div className="max-w-[1100px] mx-auto pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:px-6">{innerContent}</div>
    </section>
  );
}
