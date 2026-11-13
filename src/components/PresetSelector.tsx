import React from 'react';
import { BENCHMARK_PROBLEMS } from '../tests/numericalTests';
import { BenchmarkProblem } from '../types/numerical';
import { ArrowLeft } from 'lucide-react';

interface PresetSelectorProps {
  onSelectPreset: (problem: BenchmarkProblem) => void;
  activeExpression: string;
}

export const PresetSelector: React.FC<PresetSelectorProps> = ({
  onSelectPreset,
  activeExpression,
}) => {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <span className="text-xs font-semibold text-slate-800">
          مسائل مرجع استاندارد دانشگاهی
        </span>
        <span className="text-[11px] text-slate-500">
          بارگذاری سریع فرمول و بازه
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {BENCHMARK_PROBLEMS.map((item) => {
          const isActive = activeExpression.replace(/\s+/g, '') === item.expression.replace(/\s+/g, '');
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectPreset(item)}
              className={`min-w-0 p-3 rounded-lg border text-right transition-all cursor-pointer flex flex-col justify-between ${
                isActive
                  ? 'border-sky-500 bg-sky-50/70 shadow-xs'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div>
                <div className="text-xs font-bold text-slate-900 mb-1">{item.title}</div>
                <div className="font-mono text-xs text-sky-700 mb-1 wrap-anywhere" dir="ltr">
                  f(x) = {item.expression}
                </div>
                <p className="text-sm text-slate-500 leading-relaxed sm:line-clamp-2 sm:text-[11px]">
                  {item.description}
                </p>
              </div>

              <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[11px] text-slate-600">
                <span>ریشه معلوم: <strong className="font-mono text-slate-800">{item.knownRoot.toFixed(6)}</strong></span>
                <span className="text-sky-600 inline-flex min-h-10 items-center gap-0.5 sm:min-h-0 font-medium">
                  انتخاب <ArrowLeft className="w-3 h-3" />
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
