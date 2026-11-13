import React from 'react';
import { normalizeDigits } from '../utils/mathParser';
import { MethodType, StoppingCriterion } from '../types/numerical';
import { AlertCircle, CheckCircle } from 'lucide-react';

interface MethodParametersProps {
  method: MethodType;
  a: string;
  setA: (val: string) => void;
  b: string;
  setB: (val: string) => void;
  x0: string;
  setX0: (val: string) => void;
  x1: string;
  setX1: (val: string) => void;
  tolerance: string;
  setTolerance: (val: string) => void;
  maxIterations: string;
  setMaxIterations: (val: string) => void;
  stoppingCriterion: StoppingCriterion;
  setStoppingCriterion: (crit: StoppingCriterion) => void;
  evaluatedFa?: number | null;
  evaluatedFb?: number | null;
}

export const MethodParameters: React.FC<MethodParametersProps> = ({
  method,
  a,
  setA,
  b,
  setB,
  x0,
  setX0,
  x1,
  setX1,
  tolerance,
  setTolerance,
  maxIterations,
  setMaxIterations,
  stoppingCriterion,
  setStoppingCriterion,
  evaluatedFa,
  evaluatedFb,
}) => {
  const isBracketing = method === 'bisection' || method === 'falsePosition';
  const isNewton = method === 'newton';
  const isSecant = method === 'secant';

  const bracketConditionMet =
    evaluatedFa !== null &&
    evaluatedFb !== null &&
    evaluatedFa !== undefined &&
    evaluatedFb !== undefined &&
    evaluatedFa * evaluatedFb < 0;

  const bracketConditionFailed =
    evaluatedFa !== null &&
    evaluatedFb !== null &&
    evaluatedFa !== undefined &&
    evaluatedFb !== undefined &&
    evaluatedFa * evaluatedFb > 0;

  return (
    <div className="space-y-4">
      {/* Dynamic Initial Points / Interval */}
      {isBracketing && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <label className="text-xs font-semibold text-slate-800">
              حدود بازه محصورکننده [a, b]
            </label>
            {bracketConditionMet && (
              <span className="text-[11px] text-emerald-700 flex items-center gap-1 font-medium">
                <CheckCircle className="w-3.5 h-3.5 shrink-0" /> شرط بولزانو برقرار است (f(a)·f(b) &lt; 0)
              </span>
            )}
            {bracketConditionFailed && (
              <span className="text-[11px] text-rose-700 flex items-center gap-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" /> هشدار: f(a) و f(b) هم‌علامت هستند
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-xs text-slate-500 block mb-1">کران پایین (a):</span>
              <input
                type="text"
                dir="ltr"
                aria-label="کران پایین"
                value={a}
                onChange={(e) => setA(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-sky-100 focus:border-sky-500"
              />
              {evaluatedFa !== null && evaluatedFa !== undefined && Number.isFinite(evaluatedFa) && (
                <div className="text-[11px] text-slate-400 mt-1 font-mono wrap-anywhere" dir="ltr">
                  f(a) = {evaluatedFa.toFixed(4)}
                </div>
              )}
            </div>
            <div>
              <span className="text-xs text-slate-500 block mb-1">کران بالا (b):</span>
              <input
                type="text"
                dir="ltr"
                aria-label="کران بالا"
                value={b}
                onChange={(e) => setB(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-sky-100 focus:border-sky-500"
              />
              {evaluatedFb !== null && evaluatedFb !== undefined && Number.isFinite(evaluatedFb) && (
                <div className="text-[11px] text-slate-400 mt-1 font-mono wrap-anywhere" dir="ltr">
                  f(b) = {evaluatedFb.toFixed(4)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isNewton && (
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-800 block mb-1">
            حدس اولیه (x₀)
          </label>
          <div className="max-w-xs">
            <input
              type="text"
              dir="ltr"
              aria-label="حدس اولیه"
              value={x0}
              onChange={(e) => setX0(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-sky-100 focus:border-sky-500"
            />
          </div>
          <span className="text-[11px] text-slate-500">
            حدسی نزدیک به ریشه انتخاب کنید تا از واگرایی یا برخورد با مشتق صفر جلوگیری شود.
          </span>
        </div>
      )}

      {isSecant && (
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-800 block">
            دو حدس اولیه دلخواه (x₀ و x₁)
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-xs text-slate-500 block mb-1">حدس اول (x₀):</span>
              <input
                type="text"
                dir="ltr"
                aria-label="حدس اول"
                value={x0}
                onChange={(e) => setX0(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-sky-100 focus:border-sky-500"
              />
            </div>
            <div>
              <span className="text-xs text-slate-500 block mb-1">حدس دوم (x₁):</span>
              <input
                type="text"
                dir="ltr"
                aria-label="حدس دوم"
                value={x1}
                onChange={(e) => setX1(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-sky-100 focus:border-sky-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Stopping Criteria & Tolerance Grid */}
      <div className="pt-2 border-t border-slate-200 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-3">
        {/* Tolerance */}
        <div>
          <label className="text-xs font-semibold text-slate-800 block mb-1">
            دقت همگرایی (ε)
          </label>
          <input
            type="text"
            dir="ltr"
            aria-label="تلورانس"
            value={tolerance}
            onChange={(e) => setTolerance(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono text-base sm:text-xs focus:ring-2 focus:ring-sky-100 focus:border-sky-500"
          />
          <div className="flex flex-wrap gap-1 mt-1 text-[10px]">
            {[1e-3, 1e-6, 1e-8, 1e-12].map((tol) => (
              <button
                key={tol}
                type="button"
                onClick={() => setTolerance(String(tol))}
                className={`min-h-8 px-1.5 py-0.5 rounded font-mono sm:min-h-0 transition-colors cursor-pointer ${
                  Number(normalizeDigits(tolerance)) === tol ? 'bg-sky-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                10^{Math.round(Math.log10(tol))}
              </button>
            ))}
          </div>
        </div>

        {/* Max Iterations */}
        <div>
          <label className="text-xs font-semibold text-slate-800 block mb-1">
            سقف تکرار (N_max)
          </label>
          <input
            type="text"
            dir="ltr"
            aria-label="سقف تکرار"
            inputMode="numeric"
            value={maxIterations}
            onChange={(e) => setMaxIterations(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono text-base sm:text-xs focus:ring-2 focus:ring-sky-100 focus:border-sky-500"
          />
          <span className="text-[10px] text-slate-400 mt-1 block">
            جلوگیری از حلقه بی‌نهایت در صورت واگرایی
          </span>
        </div>

        {/* Stopping Criterion */}
        <div className="col-span-2 sm:col-span-1 lg:col-span-2 xl:col-span-1">
          <label className="text-xs font-semibold text-slate-800 block mb-1">
            معیار توقف الگوریتم
          </label>
          <select
            aria-label="معیار توقف الگوریتم"
            value={stoppingCriterion}
            onChange={(e) => setStoppingCriterion(e.target.value as StoppingCriterion)}
            className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 text-base sm:text-xs focus:ring-2 focus:ring-sky-100 focus:border-sky-500 cursor-pointer"
          >
            <option value="absolute_error">خطای مطلق {method === 'bisection' ? '(b − a) / 2' : '|Δx|'} &lt; ε</option>
            <option value="relative_error">خطای نسبی |Δx| / |x| &lt; ε</option>
            <option value="residual">باقیمانده تابع |f(x)| &lt; ε</option>
            <option value="combined">ترکیب خطا و باقیمانده تابع</option>
          </select>
          <span className="text-[10px] text-slate-400 mt-1 block">
            تفکیک خطای تخمین از باقیمانده
          </span>
        </div>
      </div>
    </div>
  );
};
