import React, { useState, useEffect, useMemo } from 'react';
import { MethodType, StoppingCriterion, SolverResult, BenchmarkProblem } from './types/numerical';
import { compileExpression, getSymbolicDerivative, normalizeDigits } from './utils/mathParser';
import { solveBisection, solveNewtonRaphson, solveSecant, solveFalsePosition } from './algorithms';
import { Header } from './components/Header';
import { MathInput } from './components/MathInput';
import { MethodSelector } from './components/MethodSelector';
import { MethodParameters } from './components/MethodParameters';
import { PresetSelector } from './components/PresetSelector';
import { SolverResultCard } from './components/SolverResultCard';
import { IterationTable } from './components/IterationTable';
import { FunctionPlot } from './components/FunctionPlot';
import { ValidationTestsModal } from './components/ValidationTestsModal';
import { EducationalGuide } from './components/EducationalGuide';
import { WorkedSolution } from './components/WorkedSolution';
import { AccountPanel } from './components/AccountPanel';
import { InterpolationPanel } from './components/InterpolationPanel';
import { Calculator, Play, Sparkles } from 'lucide-react';

interface SolverRun {
  expression: string;
  fn: (x: number) => number;
  result: SolverResult;
  initial: number[];
}

function readNumber(value: string | number) {
  const input = normalizeDigits(String(value)).trim();
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(input)) return NaN;
  const parsed = Number(input);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function evaluateAt(fn: ((x: number) => number) | null, x: number) {
  if (!fn || !Number.isFinite(x)) return null;
  try { return fn(x); } catch { return null; }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'solver' | 'benchmarks' | 'tests' | 'guide' | 'panel' | 'interpolation'>(() =>
    /^#panel(?:\/|$)/.test(location.hash) ? 'panel' : 'solver');
  
  // Mathematical expression state
  const [expression, setExpression] = useState<string>('x^3 - x - 2');
  const [customDerivative, setCustomDerivative] = useState<string>('3 * x^2 - 1');
  const [useCustomDerivative, setUseCustomDerivative] = useState<boolean>(false);

  // Method state
  const [selectedMethod, setSelectedMethod] = useState<MethodType>('bisection');

  const [a, setA] = useState('1');
  const [b, setB] = useState('2');
  const [x0, setX0] = useState('1.5');
  const [x1, setX1] = useState('2');
  const [tolerance, setTolerance] = useState('1e-6');
  const [maxIterations, setMaxIterations] = useState('50');
  const [stoppingCriterion, setStoppingCriterion] = useState<StoppingCriterion>('absolute_error');
  const [decimalPlaces, setDecimalPlaces] = useState(6);
  const [run, setRun] = useState<SolverRun | null>(null);
  const [inputError, setInputError] = useState('');
  const [activeStep, setActiveStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const { fn: compiledFn, error: syntaxError } = useMemo(() => compileExpression(expression), [expression]);
  const derivative = useMemo(() => compileExpression(customDerivative), [customDerivative]);
  const evaluatedFa = evaluateAt(compiledFn, readNumber(a));
  const evaluatedFb = evaluateAt(compiledFn, readNumber(b));
  const result = run?.result ?? null;
  const iterationCount = result?.iterations.at(-1)?.step ?? 0;

  const solve = (problem?: BenchmarkProblem, method = selectedMethod) => {
    const source = problem?.expression ?? expression;
    const fn = problem ? compileExpression(source).fn : compiledFn;
    const manualDerivative = !problem && useCustomDerivative;
    const first = readNumber(problem?.defaultInterval[0] ?? a);
    const last = readNumber(problem?.defaultInterval[1] ?? b);
    const guess = readNumber(problem?.defaultInitialGuesses[0] ?? x0);
    const nextGuess = readNumber(problem?.defaultInitialGuesses[1] ?? x1);
    const epsilon = readNumber(tolerance);
    const limit = readNumber(maxIterations);
    const bracketed = method === 'bisection' || method === 'falsePosition';

    setInputError('');
    setActiveStep(0);
    setIsPlaying(false);

    if (!fn || !(epsilon > 0) || !Number.isInteger(limit) || limit < 1 || limit > 500) {
      setRun(null);
      setInputError(!fn ? (syntaxError ?? 'عبارت تابع را بررسی کنید.') : !(epsilon > 0)
        ? 'تلورانس باید یک عدد مثبت و متناهی باشد.'
        : 'سقف تکرار باید عددی صحیح بین ۱ تا ۵۰۰ باشد.');
      return;
    }
    if (bracketed ? !Number.isFinite(first) || !Number.isFinite(last) || first >= last
      : !Number.isFinite(guess) || (method === 'secant' && (!Number.isFinite(nextGuess) || guess === nextGuess))) {
      setRun(null);
      setInputError(bracketed ? 'هر دو کران را وارد کنید. کران پایین باید از کران بالا کوچک‌تر باشد.'
        : method === 'secant' ? 'برای روش وتری دو حدس عددی متفاوت وارد کنید.' : 'حدس اولیه باید عددی متناهی باشد.');
      return;
    }
    if (method === 'newton' && manualDerivative && !derivative.fn) {
      setRun(null);
      setInputError(`مشتق دستی: ${derivative.error}`);
      return;
    }

    const options = { tolerance: epsilon, maxIterations: limit, stoppingCriterion };
    let solved: SolverResult;
    switch (method) {
      case 'bisection':
        solved = solveBisection({ fn, a: first, b: last, options });
        break;
      case 'falsePosition':
        solved = solveFalsePosition({ fn, a: first, b: last, options });
        break;
      case 'newton': {
        const symbolic = manualDerivative ? null : getSymbolicDerivative(source).derivativeExpr;
        const dfn = manualDerivative ? derivative.fn : symbolic ? compileExpression(symbolic).fn : null;
        solved = solveNewtonRaphson({ fn, dfn, x0: guess, options });
        break;
      }
      case 'secant':
        solved = solveSecant({ fn, x0: guess, x1: nextGuess, options });
        break;
    }
    setRun({
      expression: source, fn, result: solved,
      initial: bracketed ? [first, last] : method === 'secant' ? [guess, nextGuess] : [guess],
    });
  };

  useEffect(() => { solve(); }, []);

  useEffect(() => {
    const openPanel = () => { if (/^#panel(?:\/|$)/.test(location.hash)) setActiveTab('panel'); };
    window.addEventListener('hashchange', openPanel);
    return () => window.removeEventListener('hashchange', openPanel);
  }, []);

  useEffect(() => {
    if (!isPlaying || activeStep >= iterationCount) return;
    const timer = window.setTimeout(() => {
      const nextStep = activeStep + 1;
      setActiveStep(nextStep);
      if (nextStep === iterationCount) setIsPlaying(false);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [activeStep, isPlaying, iterationCount]);

  const handleSolve = () => {
    setActiveTab('solver');
    solve();
  };

  const handleSelectPreset = (problem: BenchmarkProblem) => {
    setExpression(problem.expression);
    setCustomDerivative(problem.derivativeExpr ?? '');
    setUseCustomDerivative(false);
    setA(String(problem.defaultInterval[0]));
    setB(String(problem.defaultInterval[1]));
    setX0(String(problem.defaultInitialGuesses[0]));
    setX1(String(problem.defaultInitialGuesses[1]));
    setActiveTab('solver');
    solve(problem);
  };

  return (
    <div className="numralab min-h-screen text-slate-900 flex flex-col font-sans">
      {/* Top Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onQuickSolve={handleSolve}
      />

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full min-w-0 mx-auto px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
        <div className="mb-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => setActiveTab('interpolation')} aria-current={activeTab === 'interpolation' ? 'page' : undefined}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-sky-800">درون‌یابی و ورود از تصویر</button>
          <button type="button" onClick={() => setActiveTab('panel')} aria-current={activeTab === 'panel' ? 'page' : undefined}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-sky-800">پنل دانشجو و استاد</button>
        </div>
        {activeTab === 'panel' && <AccountPanel />}
        {activeTab === 'interpolation' && <InterpolationPanel />}
        {/* Tab 1: Interactive Solver */}
        {activeTab === 'solver' && (
          <div className="space-y-6">
            <section className="solver-hero grid items-center gap-5 p-5 sm:p-8 md:grid-cols-[1.5fr_1fr]" aria-labelledby="solver-title">
              <div>
                <p className="mb-2 text-xs font-bold text-sky-950">محاسبات عددی IEAUM</p>
                <h1 id="solver-title" className="text-4xl font-black sm:text-6xl">نامرالب</h1>
                <p className="mt-3 max-w-lg text-sm leading-7 text-sky-950 sm:text-base">معادله‌ات را وارد کن، روش حل را انتخاب کن و محاسبات را روی نمودار و در حل تشریحی دنبال کن.</p>
              </div>
              <div className="hero-equation min-w-0 rounded-xl p-3 text-center text-white sm:p-5">
                <span dir="ltr" className="font-mono text-xl sm:text-3xl" aria-label="ایکس به توان سه منهای ایکس منهای دو برابر صفر">x³ − x − 2 = 0</span>
              </div>
            </section>
            {/* Split layout: Controls on right (in RTL), Visualizer & Table on left */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
              
              {/* Parameter Deck & Input (5 cols) */}
              <div className="min-w-0 lg:col-span-5 space-y-4">
                <div className="solver-panel p-3.5 sm:p-5 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-x-2 pb-3 border-b border-slate-100">
                    <span className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <Calculator className="w-4 h-4 shrink-0 text-sky-600" />
                      تنظیمات ورودی و الگوریتم
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSelectPreset({
                        id: 'cubic',
                        title: '',
                        expression: 'x^3 - x - 2',
                        derivativeExpr: '3 * x^2 - 1',
                        defaultInterval: [1, 2],
                        defaultInitialGuesses: [1, 2],
                        knownRoot: 1.5213797,
                        description: '',
                      })}
                      className="min-h-10 sm:min-h-0 text-xs text-sky-600 hover:text-sky-800 flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      مثال پیش‌فرض
                    </button>
                  </div>

                  {/* 1. Method Selector */}
                  <MethodSelector
                    selectedMethod={selectedMethod}
                    setSelectedMethod={(method) => {
                      setSelectedMethod(method);
                      solve(undefined, method);
                    }}
                  />

                  {/* 2. Math Expression Input */}
                  <MathInput
                    expression={expression}
                    setExpression={setExpression}
                    syntaxError={syntaxError}
                    customDerivative={customDerivative}
                    setCustomDerivative={setCustomDerivative}
                    useCustomDerivative={useCustomDerivative}
                    setUseCustomDerivative={setUseCustomDerivative}
                    showDerivativeSection={selectedMethod === 'newton'}
                  />

                  {/* 3. Method Parameters */}
                  <MethodParameters
                    method={selectedMethod}
                    a={a}
                    setA={setA}
                    b={b}
                    setB={setB}
                    x0={x0}
                    setX0={setX0}
                    x1={x1}
                    setX1={setX1}
                    tolerance={tolerance}
                    setTolerance={setTolerance}
                    maxIterations={maxIterations}
                    setMaxIterations={setMaxIterations}
                    stoppingCriterion={stoppingCriterion}
                    setStoppingCriterion={setStoppingCriterion}
                    evaluatedFa={evaluatedFa}
                    evaluatedFb={evaluatedFb}
                  />

                  {inputError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{inputError}</p>}

                  <button
                    type="button"
                    onClick={handleSolve}
                    className="w-full py-3 bg-sky-600 hover:bg-sky-700 active:scale-[0.99] disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Play className="w-4 h-4" />
                    <span>محاسبه و یافتن ریشه معادله</span>
                  </button>
                </div>
              </div>

              {/* Visualization, Summary & Table (7 cols) */}
              <div className="min-w-0 lg:col-span-7 space-y-4 sm:space-y-5">
                {/* Result Card */}
                <SolverResultCard
                  result={result}
                  decimalPlaces={decimalPlaces}
                  setDecimalPlaces={setDecimalPlaces}
                />

                {/* Function Graph Visualizer */}
                <div className="solver-panel p-3.5 sm:p-5">
                  <FunctionPlot
                    fn={run?.fn ?? compiledFn}
                    expression={run?.expression ?? expression}
                    result={result}
                    initial={run?.initial}
                    method={result?.method ?? selectedMethod}
                    activeStep={activeStep}
                    onStepChange={setActiveStep}
                    isPlaying={isPlaying}
                    onPlayChange={setIsPlaying}
                  />
                </div>

                {run && <WorkedSolution result={run.result} initial={run.initial} activeStep={activeStep} onStepChange={(step) => {
                  setIsPlaying(false);
                  setActiveStep(step);
                }} />}
                {/* Iterations Table */}
                <div className="solver-panel p-3.5 sm:p-5">
                  <IterationTable
                    result={result}
                    decimalPlaces={decimalPlaces}
                    activeStep={activeStep}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Reference Problems */}
        {activeTab === 'benchmarks' && (
          <div className="space-y-4">
            <div className="p-3.5 sm:p-5 bg-white border border-slate-200 rounded-xl shadow-xs">
              <h2 className="text-base font-bold text-slate-900 mb-1">
                کتابخانه مسائل مرجع و امتحانی محاسبات عددی
              </h2>
              <p className="text-xs text-slate-500">
                مجموعه معادلات متداول دانشگاهی همراه با ریشه معلوم برای بررسی سرعت همگرایی و رفتار الگوریتم‌ها
              </p>
            </div>
            <div className="p-3.5 sm:p-5 bg-white border border-slate-200 rounded-xl shadow-xs">
              <PresetSelector
                activeExpression={expression}
                onSelectPreset={handleSelectPreset}
              />
            </div>
          </div>
        )}

        {/* Tab 3: Automated Validation Test Suite */}
        {activeTab === 'tests' && (
          <ValidationTestsModal />
        )}

        {/* Tab 4: Theoretical & Educational Guide */}
        {activeTab === 'guide' && (
          <EducationalGuide />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>سامانه محاسبات عددی دانشجویی · حل معادلات غیرخطی f(x) = 0</span>
          <a href="https://ieaum.ir/" className="hover:text-sky-800">مهندسان صنایع دانشگاه آزاد مشهد · IEAUM</a>
        </div>
      </footer>
    </div>
  );
}
