import React from 'react';
import { BookOpen, CheckCircle2, HelpCircle } from 'lucide-react';

interface HeaderProps {
  activeTab: 'solver' | 'benchmarks' | 'tests' | 'guide' | 'interpolation';
  setActiveTab: (tab: 'solver' | 'benchmarks' | 'tests' | 'guide') => void;
  onQuickSolve: () => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, onQuickSolve }) => {
  const actionClass = 'inline-flex h-11 w-[clamp(3.5rem,18vw,5.75rem)] shrink-0 items-center justify-center whitespace-nowrap rounded-lg text-xs font-bold';
  return (
    <header className="brand-header sticky top-0 z-40 backdrop-blur-sm border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-14 items-center justify-between gap-2 py-1.5 lg:h-16 lg:gap-4 lg:py-0 xl:gap-8">
          
          {/* Zone 1: Single text wordmark */}
          <div className="flex min-w-0 items-center gap-2 lg:gap-3">
            <img src="/ieaum-logo.png" alt="" width="36" height="36" className="size-8 shrink-0 rounded-lg lg:size-9" />
            <div className="flex flex-col">
              <b className="brand-wordmark" dir="ltr">NUMRALAB</b>
            </div>
          </div>

          {/* Zone 2: Navigation Links */}
          <nav aria-label="ناوبری اصلی" className="hidden lg:flex items-center gap-3 xl:gap-6 text-sm font-medium text-slate-600">
            <button
              type="button"
              onClick={() => setActiveTab('solver')}
              aria-current={activeTab === 'solver' ? 'page' : undefined}
              className={`transition-colors whitespace-nowrap py-1 cursor-pointer ${
                activeTab === 'solver'
                  ? 'text-sky-600 font-semibold border-b-2 border-sky-600'
                  : 'hover:text-slate-900'
              }`}
            >
              حل‌کننده تعاملی
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('benchmarks')}
              aria-current={activeTab === 'benchmarks' ? 'page' : undefined}
              className={`transition-colors whitespace-nowrap py-1 cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'benchmarks'
                  ? 'text-sky-600 font-semibold border-b-2 border-sky-600'
                  : 'hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              مسائل مرجع کتب درسی
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('tests')}
              aria-current={activeTab === 'tests' ? 'page' : undefined}
              className={`transition-colors whitespace-nowrap py-1 cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'tests'
                  ? 'text-sky-600 font-semibold border-b-2 border-sky-600'
                  : 'hover:text-slate-900'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              آزمون‌های اعتبارسنجی
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('guide')}
              aria-current={activeTab === 'guide' ? 'page' : undefined}
              className={`transition-colors whitespace-nowrap py-1 cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'guide'
                  ? 'text-sky-600 font-semibold border-b-2 border-sky-600'
                  : 'hover:text-slate-900'
              }`}
            >
              <HelpCircle className="w-4 h-4" />
              راهنمای علمی و تئوری
            </button>
          </nav>

          {/* Zone 3: Primary Action */}
          <div className="flex items-center gap-2 shrink-0">
            <a href="https://ieaum.ir/" className={`${actionClass} border border-slate-200 hover:text-sky-800`} aria-label="بازگشت به درگاه IEAUM">IEAUM ↗</a>
            <button
              type="button"
              onClick={onQuickSolve}
              className={`${actionClass} cursor-pointer bg-sky-600 text-white shadow-sm transition-all hover:bg-sky-700 active:scale-95`}
            >
              محاسبه
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav Bar */}
      <nav aria-label="ناوبری اصلی" className="grid grid-cols-4 gap-1 border-t border-slate-100 bg-slate-50 px-2 py-1 text-xs sm:px-6 lg:hidden">
        <button
          type="button"
          onClick={() => setActiveTab('solver')}
          aria-current={activeTab === 'solver' ? 'page' : undefined}
          className={`min-h-11 rounded-md px-1 font-medium ${activeTab === 'solver' ? 'text-sky-800 bg-sky-100' : 'text-slate-600'}`}
        >
          حل‌کننده
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('benchmarks')}
          aria-current={activeTab === 'benchmarks' ? 'page' : undefined}
          className={`min-h-11 rounded-md px-1 font-medium ${activeTab === 'benchmarks' ? 'text-sky-800 bg-sky-100' : 'text-slate-600'}`}
        >
          مسائل مرجع
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('tests')}
          aria-current={activeTab === 'tests' ? 'page' : undefined}
          className={`min-h-11 rounded-md px-1 font-medium ${activeTab === 'tests' ? 'text-emerald-800 bg-emerald-100' : 'text-slate-600'}`}
        >
          آزمون‌ها
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('guide')}
          aria-current={activeTab === 'guide' ? 'page' : undefined}
          className={`min-h-11 rounded-md px-1 font-medium ${activeTab === 'guide' ? 'text-sky-800 bg-sky-100' : 'text-slate-600'}`}
        >
          تئوری
        </button>
      </nav>
    </header>
  );
};
