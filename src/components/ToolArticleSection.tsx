import { useEffect } from 'react';
import { BookOpen, CheckCircle2, HelpCircle, ShieldCheck } from 'lucide-react';
import { getToolArticle } from '../data/toolArticlesData';
import { ToolCatalogItem } from '../types/tools';
import { AdSlot } from './AdSlot';

interface ToolArticleSectionProps {
  tool: ToolCatalogItem;
}

export function ToolArticleSection({ tool }: ToolArticleSectionProps) {
  const article = getToolArticle(tool);

  // Inject tool-specific HowTo + FAQPage structured JSON-LD cleanly on tool view
  useEffect(() => {
    const scriptId = 'vcpl-tool-jsonld';
    let scriptEl = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!scriptEl) {
      scriptEl = document.createElement('script');
      scriptEl.id = scriptId;
      scriptEl.type = 'application/ld+json';
      document.head.appendChild(scriptEl);
    }

    const structuredData = [
      {
        '@context': 'https://schema.org',
        '@type': 'HowTo',
        name: `How to Use ${tool.title}`,
        description: article.seoDescription,
        step: article.howToUse.map((step, index) => ({
          '@type': 'HowToStep',
          position: index + 1,
          name: step.stepTitle,
          text: step.detail,
        })),
      },
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: article.faqs.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer,
          },
        })),
      },
    ];

    scriptEl.textContent = JSON.stringify(structuredData);

    return () => {
      const existingScript = document.getElementById(scriptId);
      if (existingScript) existingScript.remove();
    };
  }, [article, tool.title]);

  return (
    <article
      aria-labelledby={`article-heading-${tool.id}`}
      className="w-full bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-6 sm:p-8 shadow-[0_4px_0_#2F3E4E] dark:shadow-[0_4px_0_#020617] space-y-8 no-print"
    >
      {/* Article Title & Authoritative Overview */}
      <header className="space-y-3 pb-6 border-b border-[#2F3E4E]/15 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#475569] dark:text-slate-400">
          <BookOpen className="w-4 h-4 text-[#2F3E4E] dark:text-[#F9C80E]" aria-hidden="true" />
          <span>Official Tool Documentation &amp; Guide</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono font-bold text-[#2F3E4E] dark:text-[#F9C80E]">{tool.code}</span>
          <span aria-hidden="true">·</span>
          <span>{tool.categoryName}</span>
        </div>

        <h2
          id={`article-heading-${tool.id}`}
          className="font-display font-extrabold text-xl sm:text-2xl text-[#2F3E4E] dark:text-slate-50 tracking-tight [text-wrap:balance]"
        >
          How to Use {tool.title} — Guide &amp; Key Benefits
        </h2>

        <div className="space-y-2.5 text-sm sm:text-[15px] leading-relaxed text-[#334155] dark:text-slate-300 max-w-4xl">
          {article.overview.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      </header>

      {/* Step-by-Step How-to-Use Guide */}
      <section aria-labelledby={`howto-${tool.id}`} className="space-y-4">
        <h3
          id={`howto-${tool.id}`}
          className="font-display font-extrabold text-lg text-[#2F3E4E] dark:text-slate-100 tracking-tight"
        >
          Step-by-Step Instructions
        </h3>

        <ol className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {article.howToUse.map((step, idx) => (
            <li
              key={step.stepTitle}
              className="bg-[#FEF2C8]/65 dark:bg-[#0B1120] border-[1.5px] border-[#2F3E4E]/30 dark:border-slate-700 rounded-xl p-4 flex items-start gap-3.5"
            >
              <span className="w-7 h-7 rounded-lg bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#F9C80E] dark:text-[#0F172A] font-mono text-xs font-extrabold flex items-center justify-center shrink-0 mt-0.5 tabular-nums">
                {String(idx + 1).padStart(2, '0')}
              </span>
              <div className="space-y-1">
                <h4 className="font-display font-bold text-sm text-[#2F3E4E] dark:text-slate-100">
                  {step.stepTitle}
                </h4>
                <p className="text-xs sm:text-[13px] leading-relaxed text-[#475569] dark:text-slate-300">
                  {step.detail}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Main-Content-Based In-Article Ad Placement */}
      <AdSlot
        slotId={`vcpl-inarticle-${tool.code.toLowerCase()}`}
        variant="in-article"
        label={`In-Article Contextual Ad · ${tool.categoryName}`}
        contentContext={article.adTopic}
      />

      {/* Key Benefits & Advantages */}
      <section aria-labelledby={`benefits-${tool.id}`} className="space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-[#12805C] dark:text-emerald-400" aria-hidden="true" />
          <h3
            id={`benefits-${tool.id}`}
            className="font-display font-extrabold text-lg text-[#2F3E4E] dark:text-slate-100 tracking-tight"
          >
            Key Benefits of Using {tool.title}
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {article.keyBenefits.map((benefit) => (
            <div
              key={benefit.title}
              className="bg-[#CEE5DC]/45 dark:bg-[#102B25] border-[1.5px] border-[#2F3E4E]/30 dark:border-emerald-700/50 rounded-xl p-4 space-y-1.5"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2
                  className="w-4 h-4 text-[#12805C] dark:text-emerald-400 shrink-0"
                  aria-hidden="true"
                />
                <h4 className="font-display font-bold text-sm text-[#2F3E4E] dark:text-emerald-100">
                  {benefit.title}
                </h4>
              </div>
              <p className="text-xs sm:text-[13px] leading-relaxed text-[#334155] dark:text-slate-200">
                {benefit.detail}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Frequently Asked Questions */}
      <section
        aria-labelledby={`faq-${tool.id}`}
        className="space-y-4 pt-6 border-t border-[#2F3E4E]/15 dark:border-slate-800"
      >
        <div className="flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-[#2F3E4E] dark:text-[#F9C80E]" aria-hidden="true" />
          <h3
            id={`faq-${tool.id}`}
            className="font-display font-extrabold text-lg text-[#2F3E4E] dark:text-slate-100 tracking-tight"
          >
            Frequently Asked Questions
          </h3>
        </div>

        <dl className="space-y-3">
          {article.faqs.map((faq) => (
            <div
              key={faq.question}
              className="bg-white dark:bg-[#0B1120] border border-[#2F3E4E]/25 dark:border-slate-700 rounded-xl p-4 space-y-1"
            >
              <dt className="font-display font-bold text-sm text-[#2F3E4E] dark:text-slate-100">
                {faq.question}
              </dt>
              <dd className="text-xs sm:text-[13px] leading-relaxed text-[#475569] dark:text-slate-300">
                {faq.answer}
              </dd>
            </div>
          ))}
        </dl>

        {/* Semantic Topic Index */}
        <div className="pt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[#64748B] dark:text-slate-400">
          <span className="font-semibold text-[#475569] dark:text-slate-300">Related topics:</span>
          {article.focusKeywords.map((kw, idx) => (
            <span key={kw}>
              {kw}
              {idx < article.focusKeywords.length - 1 ? ' · ' : ''}
            </span>
          ))}
        </div>
      </section>
    </article>
  );
}
