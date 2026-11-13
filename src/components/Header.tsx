import React from 'react';
import { Calculator, BookOpen, CheckCircle2, HelpCircle } from 'lucide-react';

interface HeaderProps {
  activeTab: 'solver' | 'benchmarks' | 'tests' | 'guide';
  setActiveTab: (tab: 'solver' | 'benchmarks' | 'tests' | 'guide') => void;
  onQuickSolve: () => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, onQuickSolve }) => {
  return (
    <header className="brand-header sticky top-0 z-40 backdrop-blur-sm border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-14 items-center justify-between gap-2 py-1.5 lg:h-16 lg:gap-4 lg:py-0 xl:gap-8">
          
          {/* Zone 1: Single text wordmark */}
          <div className="flex min-w-0 items-center gap-2 lg:gap-3">
            <div className="brand-symbol size-8 shrink-0 lg:size-9 rounded-lg flex items-center justify-center text-white">
              <Calculator className="w-5 h-5" />
            </div>
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
            <a href="https://ieaum.ir/" className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-bold hover:text-sky-800" aria-label="بازگشت به درگاه IEAUM">IEAUM ↗</a>
            <button
              type="button"
              onClick={onQuickSolve}
              className="min-h-11 px-3 py-2 text-xs font-semibold text-white sm:px-4 lg:min-h-0 bg-sky-600 hover:bg-sky-700 active:scale-95 transition-all rounded-lg shadow-sm whitespace-nowrap cursor-pointer"
            >
              <span className="sm:hidden">محاسبه</span>
              <span className="hidden sm:inline">محاسبه و اجرای الگوریتم</span>
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
