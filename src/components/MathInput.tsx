import React from 'react';
import { AlertCircle, Check, Sparkles } from 'lucide-react';
import { expressionMathML, getSymbolicDerivative } from '../utils/mathParser';

interface MathInputProps {
  expression: string;
  setExpression: (expr: string) => void;
  syntaxError: string | null;
  customDerivative: string;
  setCustomDerivative: (df: string) => void;
  useCustomDerivative: boolean;
  setUseCustomDerivative: (val: boolean) => void;
  showDerivativeSection: boolean;
}

export const MathInput: React.FC<MathInputProps> = ({
  expression,
  setExpression,
  syntaxError,
  customDerivative,
  setCustomDerivative,
  useCustomDerivative,
  setUseCustomDerivative,
  showDerivativeSection,
}) => {
  const input = React.useRef<HTMLInputElement>(null);
  const preview = React.useMemo(() => {
    if (syntaxError) return null;
    try {
      return expressionMathML(expression);
    } catch {
      return null;
    }
  }, [expression, syntaxError]);
  const { derivativeExpr } = React.useMemo(() => {
    return showDerivativeSection ? getSymbolicDerivative(expression) : { derivativeExpr: null };
  }, [expression, showDerivativeSection]);

  const insertSymbol = (sym: string, offset = sym.length) => {
    const field = input.current;
    const start = field?.selectionStart ?? expression.length;
    const end = field?.selectionEnd ?? start;
    setExpression(expression.slice(0, start) + sym + expression.slice(end));
    requestAnimationFrame(() => {
      field?.focus();
      field?.setSelectionRange(start + offset, start + offset);
    });
  };

  const quickButtons = [
    { label: 'x', value: 'x' },
    { label: 'x²', value: '^2' },
    { label: 'x³', value: '^3' },
    { label: '√x', value: 'sqrt(x)' },
    { label: 'sin(x)', value: 'sin(x)' },
    { label: 'cos(x)', value: 'cos(x)' },
    { label: 'tan(x)', value: 'tan(x)' },
    { label: 'eˣ', value: 'exp(x)' },
    { label: 'ln(x)', value: 'ln(x)' },
    { label: '|x|', value: 'abs(x)' },
    { label: 'π', value: 'pi' },
    { label: '+', value: ' + ' },
    { label: '−', value: ' - ' },
    { label: '×', value: ' * ' },
    { label: '÷', value: ' / ' },
    { label: '^', value: '^' },
    { label: '( )', value: '()', offset: 1 },
    { label: 'کسر', value: '()/()', offset: 1 },
  ];

  return (
    <div className="space-y-4">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 mb-1.5">
          <label htmlFor="function-expression" className="text-sm font-semibold text-slate-800 flex flex-wrap items-center gap-x-1.5">
            <span>تابع غیرخطی f(x)</span>
            <span className="text-xs font-normal text-slate-500">(تابع یا معادله)</span>
          </label>
          <div className="text-xs text-slate-500 flex items-center gap-2">
            {!syntaxError && expression.trim() && (
              <span className="text-emerald-700 flex items-center gap-1 font-medium text-xs">
                <Check className="w-3.5 h-3.5" /> ساختار معتبر است
              </span>
            )}
          </div>
        </div>

        {/* Input Field */}
        <div className="relative">
          <div className="absolute right-3.5 top-3 text-slate-400 font-serif italic text-base select-none">
            f(x) =
          </div>
          <input
            id="function-expression"
            ref={input}
            type="text"
            dir="ltr"
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            placeholder="مثال: x³ − x = ۲"
            spellCheck={false}
            autoComplete="off"
            aria-invalid={Boolean(syntaxError)}
            className={`w-full pr-16 pl-4 py-2.5 bg-white border rounded-lg text-slate-900 font-mono text-base tracking-wide sm:text-sm focus:outline-none focus:ring-2 transition-all ${
              syntaxError
                ? 'border-rose-400 focus:ring-rose-200'
                : 'border-slate-300 focus:border-sky-500 focus:ring-sky-100'
            }`}
          />
        </div>
        {preview && (
          <div className="formula-preview mt-2 rounded-lg bg-slate-50" dir="ltr" aria-label="پیش‌نمایش تابعی که حل می‌شود"
            dangerouslySetInnerHTML={{ __html: '<math><mi>f</mi><mo>(</mo><mi>x</mi><mo>)</mo><mo>=</mo>' + preview + '</math>' }} />
        )}

        {/* Error Message */}
        {syntaxError && (
          <div className="mt-2 text-xs text-rose-700 flex items-start gap-1.5 bg-rose-50 border border-rose-200 p-2.5 rounded-md">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{syntaxError}</span>
          </div>
        )}
      </div>

      {/* Quick Insert Keypad */}
      <div>
        <div className="text-xs text-slate-500 mb-1.5 flex flex-wrap items-center justify-between gap-x-2">
          <span>درج سریع توابع و نمادها:</span>
          <span className="text-[11px] text-slate-400">بدون نیاز به کدنویسی</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {quickButtons.map((btn) => (
            <button
              key={btn.label}
              type="button"
              onClick={() => insertSymbol(btn.value, btn.offset)}
              className="min-h-10 px-2.5 py-1 text-xs sm:min-h-0 font-mono bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 rounded transition-colors cursor-pointer"
            >
              {btn.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setExpression('')}
            className="min-h-10 px-2.5 py-1 text-xs sm:min-h-0 font-sans text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer mr-auto"
          >
            پاک کردن
          </button>
        </div>
      </div>

      {/* Derivative Section (especially relevant for Newton-Raphson) */}
      {showDerivativeSection && (
        <div className="pt-2 border-t border-slate-200/80">
          <div className="flex flex-wrap items-center justify-between gap-x-2 mb-2">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-xs font-semibold text-slate-800">مشتق تابع f'(x)</span>
              <span className="text-[11px] text-slate-500">(موردنیاز روش نیوتون–رافسون)</span>
            </div>
            <label className="flex min-h-10 items-center gap-1.5 text-xs text-slate-600 cursor-pointer sm:min-h-0">
              <input
                type="checkbox"
                checked={useCustomDerivative}
                onChange={(e) => setUseCustomDerivative(e.target.checked)}
                className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              <span>تعیین دستی مشتق</span>
            </label>
          </div>

          {!useCustomDerivative ? (
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-slate-500 italic">f'(x) =</span>
                <span className="text-slate-800 font-semibold text-left wrap-anywhere" dir="ltr">
                  {derivativeExpr || 'محاسبه عددی پیوسته تفاضل مرکزی (Central Difference)'}
                </span>
              </div>
              {derivativeExpr && (
                <span className="text-[11px] text-sky-700 bg-sky-50 px-2 py-0.5 rounded font-sans flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> مشتق تحلیلی خودکار
                </span>
              )}
            </div>
          ) : (
            <div>
              <input
                type="text"
                dir="ltr"
                value={customDerivative}
                onChange={(e) => setCustomDerivative(e.target.value)}
                placeholder="فرمول مشتق را وارد کنید، مثلاً: 3*x^2 - 1"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono text-base sm:text-xs focus:outline-none focus:ring-2 focus:ring-sky-100 focus:border-sky-500"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
