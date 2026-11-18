import {
  ArrowRight,
  Building2,
  Calculator,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  Image as ImageIcon,
  IndianRupee,
  Keyboard,
  Landmark,
  Receipt,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { TOOL_CATEGORIES } from '../data/toolsCatalog';
import { CategoryItem, ToolFilterType } from '../types/tools';

interface CategoriesSectionProps {
  selectedCategoryId: string;
  onSelectCategory: (categoryId: string, filterKey: ToolFilterType) => void;
}

export function CategoriesSection({
  selectedCategoryId,
  onSelectCategory,
}: CategoriesSectionProps) {
  const renderCategoryIcon = (iconName: CategoryItem['iconName']) => {
    switch (iconName) {
      case 'landmark':
        return <Landmark className="w-5 h-5" />;
      case 'calculator':
        return <Calculator className="w-5 h-5" />;
      case 'file-spreadsheet':
        return <FileSpreadsheet className="w-5 h-5" />;
      case 'search':
        return <Search className="w-5 h-5" />;
      case 'indian-rupee':
        return <IndianRupee className="w-5 h-5" />;
      case 'graduation-cap':
        return <GraduationCap className="w-5 h-5" />;
      case 'sliders':
        return <SlidersHorizontal className="w-5 h-5" />;
      case 'receipt':
        return <Receipt className="w-5 h-5" />;
      case 'file-text':
        return <FileText className="w-5 h-5" />;
      case 'image':
        return <ImageIcon className="w-5 h-5" />;
      case 'keyboard':
        return <Keyboard className="w-5 h-5" />;
      case 'building-2':
        return <Building2 className="w-5 h-5" />;
    }
  };

  return (
    <section id="categories" className="w-full bg-[#FFE1B3] dark:bg-[#0F172A] py-14 md:py-16 border-b border-[#2F3E4E]/15 dark:border-slate-800 transition-colors duration-200">
      <div className="max-w-[1400px] mx-auto pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-[#475569] dark:text-slate-400">
              Nine Integrated Suites · Zero Installation
            </p>
            <h2 className="font-display font-extrabold text-[clamp(1.65rem,3vw,2.25rem)] text-[#2F3E4E] dark:text-slate-50 tracking-tight [text-wrap:balance]">
              Explore Tools by Category
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-[#334155] dark:text-slate-300 max-w-md">
            Pick any suite below to jump directly to its tools in the workspace.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9 gap-3">
          {TOOL_CATEGORIES.map((category) => {
            const isSelected = selectedCategoryId === category.id;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => onSelectCategory(category.id, category.filterKey)}
                className={`group rounded-2xl p-3.5 sm:p-4 min-h-[112px] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 text-left flex flex-col justify-between gap-3 sm:gap-4 transition-all duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F3E4E] dark:focus-visible:ring-[#F9C80E] ${
                  isSelected
                    ? 'bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#FFFDF5] dark:text-[#0F172A] dark:border-[#F9C80E] shadow-[0_4px_0_#1E293B] dark:shadow-[0_4px_0_#020617] -translate-y-0.5'
                    : 'bg-[#FFFDF5] dark:bg-[#131C2E] text-[#2F3E4E] dark:text-slate-100 hover:bg-white dark:hover:bg-[#1A253B] dark:hover:border-slate-500 hover:-translate-y-0.5 hover:shadow-[0_4px_0_#2F3E4E] dark:hover:shadow-[0_4px_0_#020617]'
                }`}
              >
                <div className="flex items-center justify-between gap-2 w-full">
                  <span
                    className={`w-10 h-10 rounded-xl border-[1.5px] flex items-center justify-center shrink-0 transition-colors ${
                      isSelected
                        ? 'bg-[#F9C80E] dark:bg-[#0F172A] border-[#F9C80E] dark:border-[#0F172A] text-[#2F3E4E] dark:text-[#F9C80E]'
                        : 'bg-[#CEE5DC]/75 dark:bg-emerald-500/20 border-[#2F3E4E] dark:border-emerald-400/40 text-[#2F3E4E] dark:text-emerald-300 group-hover:bg-[#F9C80E] dark:group-hover:bg-[#F9C80E] dark:group-hover:text-[#0F172A] dark:group-hover:border-[#F9C80E]'
                    }`}
                  >
                    {renderCategoryIcon(category.iconName)}
                  </span>
                  <ArrowRight
                    className={`w-4 h-4 transition-transform duration-150 group-hover:translate-x-0.5 ${
                      isSelected
                        ? 'text-[#F9C80E] dark:text-[#0F172A]'
                        : 'text-[#64748B] dark:text-slate-400 group-hover:text-[#2F3E4E] dark:group-hover:text-slate-100'
                    }`}
                    aria-hidden="true"
                  />
                </div>

                <div>
                  <div className="font-display font-bold text-[13px] sm:text-sm leading-snug break-words">
                    {category.name}
                  </div>
                  <div
                    className={`mt-1 text-xs font-mono tabular-nums ${
                      isSelected
                        ? 'text-[#CBD5E1] dark:text-[#0F172A]/80'
                        : 'text-[#64748B] dark:text-slate-400'
                    }`}
                  >
                    {category.countLabel}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
