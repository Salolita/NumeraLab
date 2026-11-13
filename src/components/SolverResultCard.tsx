import React from 'react';
import { SolverResult } from '../types/numerical';
import { CheckCircle2, AlertTriangle, XCircle, Clock, Copy, Check } from 'lucide-react';

interface SolverResultCardProps {
  result: SolverResult | null;
  decimalPlaces: number;
  setDecimalPlaces: (n: number) => void;
}

export const SolverResultCard: React.FC<SolverResultCardProps> = ({
  result,
  decimalPlaces,
  setDecimalPlaces,
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!result) return null;

  const isSuccess = result.status === 'converged';
  const isWarning = result.status === 'max_iterations_reached';
  const isError = !isSuccess && !isWarning;

  const copyToClipboard = () => {
    if (result.root !== null) {
      navigator.clipboard.writeText(result.root.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={`p-4 rounded-xl border transition-all ${
      isSuccess
        ? 'bg-emerald-50/40 border-emerald-200'
        : isWarning
        ? 'bg-amber-50/50 border-amber-200'
        : 'bg-rose-50/50 border-rose-200'
    }`}>
      {/* Header Status */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pb-3 border-b border-slate-200/70">
        <div className="flex items-center gap-2">
          {isSuccess && <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />}
          {isWarning && <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600" />}
          {isError && <XCircle className="w-5 h-5 shrink-0 text-rose-600" />}
          <span className="text-sm font-bold text-slate-900">
            {isSuccess
              ? 'همگرایی موفق به جواب ریشه'
              : isWarning
              ? 'توقف به دلیل رسیدن به سقف تکرار'
              : 'عدم همگرایی یا خطای محاسباتی'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          <span className="flex items-center gap-1 font-mono">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            {result.executionTimeMs.toFixed(2)} ms
          </span>
          <span>تعداد تکرار: <strong className="font-mono text-slate-800">{result.iterationsCount}</strong></span>
        </div>
      </div>

      {/* Main Metric: Root and Residual */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-3">
        {/* Root */}
        <div className="min-w-0 bg-white p-3 rounded-lg border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500 font-medium">ریشه تقریبی (x*)</span>
            {result.root !== null && (
              <button
                type="button"
                onClick={copyToClipboard}
                className="min-h-10 sm:min-h-0 text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer transition-colors"
                title="کپی در حافظه"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'کپی شد' : 'کپی'}</span>
              </button>
            )}
          </div>
          <div className="font-mono text-xl sm:text-2xl font-bold text-slate-900 tracking-tight wrap-anywhere" dir="ltr">
            {result.root !== null
              ? result.root.toFixed(decimalPlaces)
              : '---'}
          </div>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-x-2 text-[11px] text-slate-400">
            <span>دقت نمایش:</span>
            <div className="flex flex-wrap gap-1">
              {[4, 6, 8, 10, 14].map((dp) => (
                <button
                  key={dp}
                  type="button"
                  onClick={() => setDecimalPlaces(dp)}
                  className={`min-h-8 min-w-7 px-1.5 py-0.5 sm:min-h-0 sm:min-w-0 rounded font-mono cursor-pointer ${
                    decimalPlaces === dp
                      ? 'bg-slate-800 text-white font-semibold'
                      : 'hover:bg-slate-100 text-slate-500'
                  }`}
                >
                  {dp}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Residual */}
        <div className="min-w-0 bg-white p-3 rounded-lg border border-slate-200/80 shadow-xs">
          <div className="text-xs text-slate-500 font-medium mb-1">
            قدرمطلق باقیمانده تابع |f(x*)|
          </div>
          <div className="font-mono text-xl sm:text-2xl font-bold text-slate-900 tracking-tight wrap-anywhere" dir="ltr">
            {result.residual !== null
              ? result.residual < 1e-4
                ? result.residual.toExponential(4)
                : result.residual.toFixed(decimalPlaces)
              : '---'}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            فاصله مقدار تابع از صفر مطلق (معیار باقیمانده)
          </div>
        </div>
      </div>

      {/* Status Message */}
      <div className={`p-2.5 rounded-lg text-xs leading-relaxed wrap-anywhere border ${
        isSuccess
          ? 'bg-emerald-100/40 text-emerald-900 border-emerald-200'
          : isWarning
          ? 'bg-amber-100/40 text-amber-900 border-amber-200'
          : 'bg-rose-100/40 text-rose-900 border-rose-200'
      }`}>
        <p>{result.statusMessage}</p>
      </div>
    </div>
  );
};
