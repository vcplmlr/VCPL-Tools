import {useState} from 'react';
import {Menu, X} from 'lucide-react';

interface TopBarProps {
  onNavigateContact: () => void;
}

const NAV_LINKS = [
  {href: '#overview', label: 'Overview'},
  {href: '#capabilities', label: 'Capabilities'},
  {href: '#work', label: 'Selected Work'},
  {href: '#contact', label: 'Contact'},
];

export function TopBar({onNavigateContact}: TopBarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 bg-slate-50/95 backdrop-blur-sm border-b border-slate-200">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        <a
          href="#overview"
          className="text-lg font-semibold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 rounded-sm"
          style={{fontFamily: 'var(--font-display)'}}
        >
          Kestrel Studio
        </a>

        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600"
        >
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="hover:text-slate-900 hover:underline underline-offset-4 decoration-slate-300 transition-colors duration-150 whitespace-nowrap shrink-0 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 rounded-sm"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onNavigateContact}
            className="hidden sm:inline-flex items-center justify-center px-4 py-2 min-h-[40px] text-sm font-medium text-white bg-blue-800 hover:bg-blue-900 rounded-lg transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2"
          >
            Start a Project
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-lg border border-slate-200 bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5" aria-hidden="true" />
            ) : (
              <Menu className="w-5 h-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-4 space-y-2">
          <nav aria-label="Mobile navigation" className="flex flex-col space-y-1">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2.5 min-h-[44px] flex items-center text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onNavigateContact();
              }}
              className="w-full min-h-[44px] px-4 py-2.5 text-sm font-medium text-white bg-blue-800 hover:bg-blue-900 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              Start a Project
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
