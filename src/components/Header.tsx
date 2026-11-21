import {useState} from 'react';
import {Menu, X} from 'lucide-react';

interface HeaderProps {
  onRequestQuote: () => void;
}

const NAV_LINKS = [
  {label: 'Capabilities', href: '#capabilities'},
  {label: 'Configurator', href: '#configurator'},
  {label: 'Case Studies', href: '#case-studies'},
  {label: 'Specifications', href: '#quote'},
];

export function Header({onRequestQuote}: HeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleMobileAction = () => {
    setMobileOpen(false);
    onRequestQuote();
  };

  return (
    <header className="sticky top-0 z-40 bg-[#F7F7F5]/95 backdrop-blur-sm border-b border-neutral-200">
      <div className="max-w-[1200px] mx-auto px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          className="text-lg font-semibold tracking-tight text-[#141413] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E40AF] focus-visible:ring-offset-2 rounded-sm"
        >
          Haldor Systems
        </a>

        {/* Zone 2: 4 single-line text navigation links */}
        <nav aria-label="Primary" className="hidden md:flex items-center gap-7">
          {NAV_LINKS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-[#575652] hover:text-[#141413] hover:underline underline-offset-4 decoration-neutral-400 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E40AF] focus-visible:ring-offset-2 rounded-sm"
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Zone 3: Single primary action + mobile menu trigger */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onRequestQuote}
            className="hidden sm:inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-[#1E40AF] hover:bg-[#1E3A8A] rounded-lg transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E40AF] focus-visible:ring-offset-2"
          >
            Request Quote
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="md:hidden inline-flex items-center justify-center w-11 h-11 text-[#141413] hover:bg-neutral-200/70 rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E40AF]"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-neutral-200 bg-[#F7F7F5] px-6 py-4 space-y-3">
          <nav aria-label="Mobile" className="flex flex-col space-y-2">
            {NAV_LINKS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="py-2 text-base font-medium text-[#141413] hover:text-[#1E40AF] transition-colors"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <button
            type="button"
            onClick={handleMobileAction}
            className="w-full py-2.5 px-4 text-sm font-medium text-white bg-[#1E40AF] hover:bg-[#1E3A8A] rounded-lg transition-colors cursor-pointer"
          >
            Request Quote
          </button>
        </div>
      )}
    </header>
  );
}
