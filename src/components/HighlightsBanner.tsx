import { Blocks, ShieldCheck, Zap } from 'lucide-react';
import { VALUE_PILLARS } from '../data/toolsCatalog';

export function HighlightsBanner() {
  const renderIcon = (icon: 'zap' | 'blocks' | 'shield') => {
    switch (icon) {
      case 'zap':
        return <Zap className="w-4 h-4" />;
      case 'blocks':
        return <Blocks className="w-4 h-4" />;
      case 'shield':
        return <ShieldCheck className="w-4 h-4" />;
    }
  };

  return (
    <section id="architecture" className="w-full bg-[#2F3E4E] text-[#FFFDF5] py-5 md:py-6">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-8">
          {VALUE_PILLARS.map((pillar) => (
            <div key={pillar.id} className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg border border-white/25 bg-white/10 flex items-center justify-center shrink-0 text-[#FEF2C8] mt-0.5">
                {renderIcon(pillar.icon)}
              </div>
              <div className="space-y-0.5">
                <h2 className="font-display font-bold text-sm md:text-[15px] text-[#FFFDF5] tracking-tight">
                  {pillar.title}
                </h2>
                <p className="text-xs leading-snug text-[#CBD5E1]">
                  {pillar.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
