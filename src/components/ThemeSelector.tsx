import { Monitor, Moon, Sun } from 'lucide-react';
import { ThemePreference } from '../hooks/useTheme';

interface ThemeSelectorProps {
  preference: ThemePreference;
  onChange: (next: ThemePreference) => void;
  size?: 'sm' | 'md' | 'header';
}

const OPTIONS: Array<{
  id: ThemePreference;
  label: string;
  Icon: typeof Sun;
}> = [
  { id: 'light', label: 'Light', Icon: Sun },
  { id: 'dark', label: 'Dark', Icon: Moon },
  { id: 'system', label: 'System', Icon: Monitor },
];

export function ThemeSelector({
  preference,
  onChange,
  size = 'sm',
}: ThemeSelectorProps) {
  return (
    <div
      role="group"
      aria-label="Theme mode selector"
      className={`inline-flex items-center rounded-lg border-[1.5px] shrink-0 transition-colors ${
        size === 'header'
          ? 'p-0.5 bg-[#FFFDF5] dark:bg-[#131C2E] border-[#2F3E4E]/25 dark:border-slate-600 shadow-[0_1px_0_rgba(47,62,78,0.12)] dark:shadow-[0_1px_0_rgba(2,6,23,0.6)]'
          : 'p-1 bg-[#FFFDF5] dark:bg-[#131C2E] border-[#2F3E4E]/30 dark:border-slate-600'
      }`}
    >
      {OPTIONS.map(({ id, label, Icon }) => {
        const active = preference === id;
        return (
          <button
            key={id}
            type="button"
            title={`${label} theme`}
            aria-label={`${label} theme`}
            aria-pressed={active}
            onClick={() => onChange(id)}
            className={`inline-flex items-center justify-center gap-1 font-display font-bold rounded-md transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F3E4E] dark:focus-visible:outline-[#F9C80E] ${
              size === 'md'
                ? 'min-h-[42px] px-3 text-xs flex-1 sm:flex-initial'
                : size === 'header'
                ? 'h-8 sm:h-7 px-2 2xl:px-2.5 text-[10.5px]'
                : 'min-h-[34px] px-2.5 text-xs'
            } ${
              active
                ? 'bg-[#2F3E4E] text-[#F9C80E] dark:bg-[#F9C80E] dark:text-[#0F172A] shadow-xs'
                : 'text-[#2F3E4E] dark:text-slate-200 hover:bg-[#FEF2C8] dark:hover:bg-slate-800 hover:text-[#2F3E4E] dark:hover:text-white'
            }`}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span
              className={
                size === 'header'
                  ? 'hidden sm:inline lg:hidden 2xl:inline'
                  : 'inline'
              }
            >
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
