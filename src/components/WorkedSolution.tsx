import { BookOpen } from 'lucide-react';
import type { IterationStep, SolverResult } from '../types/numerical';

const number = (value: number) => String(Number(value.toPrecision(9)));

function describe(row: IterationStep, method: SolverResult['method']) {
  if ('xn' in row) return {
    formula: 'xₖ₊₁ = xₖ − f(xₖ) / f′(xₖ)',
    substitution: `${number(row.xn)} − (${number(row.fxn)}) / (${number(row.dfxn)}) ≈ ${number(row.xnNext)}`,
    absolute: row.absError, relative: row.relError,
    matlab: 'xNext = xk - fxk / dfxk;',
  };
  if ('xCurr' in row) return {
    formula: 'xₖ₊₁ = xₖ − f(xₖ) · (xₖ − xₖ₋₁) / (f(xₖ) − f(xₖ₋₁))',
    substitution: `${number(row.xCurr)} − (${number(row.fxCurr)}) · (${number(row.xCurr)} − (${number(row.xPrev)})) / (${number(row.fxCurr)} − (${number(row.fxPrev)})) ≈ ${number(row.xNext)}`,
    absolute: row.absError, relative: row.relError,
    matlab: 'xNext = xk - fxk * (xk - xPrev) / (fxk - fxPrev);',
  };
  return {
    formula: method === 'bisection' ? 'c = (a + b) / 2' : 'c = (a · f(b) − b · f(a)) / (f(b) − f(a))',
    substitution: method === 'bisection' ? `(${number(row.a)} + (${number(row.b)})) / 2 ≈ ${number(row.c)}`
      : `(${number(row.a)} · (${number(row.fb)}) − ${number(row.b)} · (${number(row.fa)})) / (${number(row.fb)} − (${number(row.fa)})) ≈ ${number(row.c)}`,
    absolute: row.error, relative: row.relativeError,
    matlab: method === 'bisection' ? 'c = (a + b) / 2;' : 'c = (a * fb - b * fa) / (fb - fa);',
  };
}

interface Props {
  result: SolverResult;
  initial: number[];
  activeStep: number;
  onStepChange: (step: number) => void;
}

export function WorkedSolution({ result, initial, activeStep, onStepChange }: Props) {
  const row = activeStep > 0 ? result.iterations[activeStep - 1] : undefined;
  const next = result.iterations[activeStep];
  const step = row ? describe(row, result.method) : null;
  const residual = row && ('fc' in row ? Math.abs(row.fc) : row.nextResidual);
  const lastStep = result.iterations.at(-1)?.step ?? 0;
  const bracketed = result.method === 'bisection' || result.method === 'falsePosition';
  const tolerance = number(result.toleranceUsed);
  const criteria = {
    absolute_error: result.method === 'bisection' ? 'نیم‌طول بازه' : 'خطای مطلق',
    relative_error: 'خطای نسبی',
    residual: 'قدر مطلق مقدار تابع',
    combined: result.method === 'bisection' ? 'نیم‌طول بازه و قدر مطلق مقدار تابع' : 'خطای مطلق و قدر مطلق مقدار تابع',
  };

  return (
    <section aria-labelledby="worked-title" className="solver-panel p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="worked-title" className="flex items-center gap-2 text-base font-bold"><BookOpen className="size-4 text-sky-800" /> حل تشریحی</h2>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          مرحله
          <select className="rounded-lg border border-slate-300 bg-white px-2 py-1" value={activeStep} onChange={(event) => onStepChange(Number(event.target.value))}>
            <option value={0}>گام صفر · وضعیت اولیه</option>
            {result.iterations.filter((item) => item.step > 0).map((item) => <option key={item.step} value={item.step}>گام {item.step}</option>)}
          </select>
        </label>
      </div>
      <ol id={`solution-step-${activeStep}`} className="space-y-3 text-sm leading-relaxed">
        {!step ? (
          <li>
            <strong>{bracketed ? 'بازهٔ اولیه' : 'حدس اولیه'}</strong>
            <span className="solution-equation" dir="ltr">{bracketed ? `[${initial.map(number).join(', ')}]`
              : initial.map((value, index) => `x${index === 0 ? '₀' : '₁'} = ${number(value)}`).join(', ')}</span>
            {bracketed && <p className="text-slate-600">برای تابع پیوسته، دو سر بازه باید علامت مخالف داشته باشند یا یکی از آن‌ها ریشه باشد.</p>}
          </li>
        ) : (
          <>
            <li><strong>فرمول</strong><span className="solution-equation" dir="ltr">{step.formula}</span></li>
            <li><strong>جایگذاری و نتیجه</strong><span className="solution-equation" dir="ltr">{step.substitution}</span></li>
            <li><details><summary className="cursor-pointer text-sky-800">دستور MATLAB این مرحله</summary>
              <code className="solution-equation" dir="ltr">{step.matlab}</code>
            </details></li>
            <li>
              <strong>بررسی توقف</strong>
              <p className="mt-1 text-slate-600">{result.method === 'bisection' ? 'نیم‌طول بازه' : 'خطای مطلق'} <bdi>{number(step.absolute)}</bdi>
                {step.relative !== undefined && <>، خطای نسبی <bdi>{number(step.relative)}</bdi></>}
                {residual !== undefined && <>، قدر مطلق مقدار تابع <bdi>{number(residual)}</bdi></>}
              </p>
              {next && 'a' in next && <p className="mt-1 text-slate-600">بازهٔ بعدی <bdi>[{number(next.a)}, {number(next.b)}]</bdi> است.</p>}
            </li>
          </>
        )}
      </ol>
      <p className="text-sm text-slate-600">معیار انتخاب‌شده: {criteria[result.stoppingCriterionUsed]} کمتر از <bdi>{tolerance}</bdi></p>
      <p className="rounded-lg bg-sky-50 p-3 text-sm text-sky-900">
        {activeStep < lastStep ? 'محاسبه به گام بعد ادامه پیدا می‌کند.' : result.statusMessage}
      </p>
    </section>
  );
}
