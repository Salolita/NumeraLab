import React, { useRef, useEffect, useState, useMemo } from 'react';
import { SolverResult, MethodType } from '../types/numerical';
import { ZoomIn, ZoomOut, RotateCcw, Play, Pause, ChevronRight, ChevronLeft } from 'lucide-react';

interface FunctionPlotProps {
  fn: ((x: number) => number) | null;
  expression: string;
  result: SolverResult | null;
  method: MethodType;
  initial?: number[];
  activeStep: number;
  onStepChange: (step: number) => void;
  isPlaying: boolean;
  onPlayChange: (playing: boolean) => void;
}

export const FunctionPlot: React.FC<FunctionPlotProps> = ({
  fn,
  expression,
  result,
  method,
  initial, activeStep, onStepChange, isPlaying, onPlayChange,
}) => {
  const plotRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 680, height: 380 });
  const [viewRange, setViewRange] = useState<{ xMin: number; xMax: number; yMin: number; yMax: number }>({
    xMin: -1,
    xMax: 3,
    yMin: -4,
    yMax: 6,
  });

  const lastStep = result?.iterations.at(-1)?.step ?? 0;
  const selectStep = (step: number) => {
    onPlayChange(false);
    onStepChange(step);
  };
  const [hoverCoord, setHoverCoord] = useState<{ x: number; y: number; px: number; py: number } | null>(null);

  useEffect(() => {
    const plot = plotRef.current;
    if (!plot) return;

    const updateSize = () => {
      const { width, height } = plot.getBoundingClientRect();
      if (width > 0 && height > 0) setDimensions({ width, height });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(plot);
    return () => observer.disconnect();
  }, []);

  const initialView = useMemo(() => {
    const points = [...(initial ?? [0, 2])];
    for (const row of result?.iterations ?? []) {
      if ('a' in row) points.push(row.a, row.b, row.c);
      else if ('xn' in row) points.push(row.xn, row.xnNext);
      else points.push(row.xPrev, row.xCurr, row.xNext);
    }
    if (result?.root != null) points.push(result.root);
    const finite = points.filter(Number.isFinite);
    const left = Math.min(...finite);
    const right = Math.max(...finite);
    const padding = Math.max(0.5, (right - left) * 0.3, Math.abs(left) * 1e-12, Math.abs(right) * 1e-12);
    const xMin = left - padding;
    const xMax = right + padding;
    if (!Number.isFinite(xMax - xMin)) return { xMin: -2, xMax: 4, yMin: -5, yMax: 5 };
    const samples: number[] = [0];
    if (fn) for (let index = 0; index <= 30; index += 1) {
      try {
        const value = fn(xMin + (xMax - xMin) * (index / 30));
        if (Math.abs(value) < 100) samples.push(value);
      } catch {
        // The curve can have gaps outside the real domain of the function.
      }
    }
    const bottom = Math.min(...samples);
    const top = Math.max(...samples);
    const margin = Math.max(1, (top - bottom) * 0.25);
    return { xMin, xMax, yMin: bottom - margin, yMax: top + margin };
  }, [result, initial, fn]);

  useEffect(() => {
    setViewRange(initialView);
    setHoverCoord(null);
  }, [initialView]);

  // Coordinate mapping
  const toSvgX = (x: number) => {
    return ((x - viewRange.xMin) / (viewRange.xMax - viewRange.xMin)) * dimensions.width;
  };

  const toSvgY = (y: number) => {
    return dimensions.height - ((y - viewRange.yMin) / (viewRange.yMax - viewRange.yMin)) * dimensions.height;
  };

  const toMathX = (svgX: number) => {
    return viewRange.xMin + (svgX / dimensions.width) * (viewRange.xMax - viewRange.xMin);
  };

  // Zoom handlers
  const handleZoom = (factor: number) => {
    const xMid = (viewRange.xMin + viewRange.xMax) / 2;
    const yMid = (viewRange.yMin + viewRange.yMax) / 2;
    const xHalf = ((viewRange.xMax - viewRange.xMin) * factor) / 2;
    const yHalf = ((viewRange.yMax - viewRange.yMin) * factor) / 2;
    if (!Number.isFinite(xHalf) || !Number.isFinite(yHalf) ||
      xMid - xHalf >= xMid + xHalf || yMid - yHalf >= yMid + yHalf) return;
    setViewRange({
      xMin: xMid - xHalf,
      xMax: xMid + xHalf,
      yMin: yMid - yHalf,
      yMax: yMid + yHalf,
    });
  };

  const resetView = () => setViewRange(initialView);

  // Generate SVG path for f(x)
  const curvePath = useMemo(() => {
    if (!fn) return '';
    const numPoints = 200;
    const dx = (viewRange.xMax - viewRange.xMin) / numPoints;
    let path = '';
    let isDrawing = false;

    for (let i = 0; i <= numPoints; i++) {
      const x = viewRange.xMin + i * dx;
      try {
        const y = fn(x);
        if (Number.isFinite(y) && !Number.isNaN(y)) {
          const sx = toSvgX(x);
          const sy = toSvgY(y);

          // Clip excessively huge values
          if (sy >= -200 && sy <= dimensions.height + 200) {
            if (!isDrawing) {
              path += `M ${sx.toFixed(1)} ${sy.toFixed(1)} `;
              isDrawing = true;
            } else {
              path += `L ${sx.toFixed(1)} ${sy.toFixed(1)} `;
            }
          } else {
            isDrawing = false;
          }
        } else {
          isDrawing = false;
        }
      } catch {
        isDrawing = false;
      }
    }
    return path;
  }, [fn, viewRange, dimensions]);

  // Compute ticks
  const xTicks = useMemo(() => {
    const ticks: number[] = [];
    const span = viewRange.xMax - viewRange.xMin;
    const step = Math.pow(10, Math.floor(Math.log10(span))) / (span / Math.pow(10, Math.floor(Math.log10(span))) < 3 ? 2 : 1);
    const start = Math.ceil(viewRange.xMin / step) * step;
    for (let x = start; x <= viewRange.xMax && ticks.length < 24; x += step) {
      ticks.push(x);
    }
    return ticks;
  }, [viewRange]);

  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    const span = viewRange.yMax - viewRange.yMin;
    const step = Math.pow(10, Math.floor(Math.log10(span))) / (span / Math.pow(10, Math.floor(Math.log10(span))) < 3 ? 2 : 1);
    const start = Math.ceil(viewRange.yMin / step) * step;
    for (let y = start; y <= viewRange.yMax && ticks.length < 24; y += step) {
      ticks.push(y);
    }
    return ticks;
  }, [viewRange]);

  // Current iteration step details
  const currentStep = activeStep > 0 ? result?.iterations[activeStep - 1] : null;

  // Handle mouse hover over canvas
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const mx = toMathX(sx);
    if (fn) {
      try {
        const my = fn(mx);
        if (Number.isFinite(my)) {
          setHoverCoord({ x: mx, y: my, px: sx, py: toSvgY(my) });
          return;
        }
      } catch {}
    }
    setHoverCoord(null);
  };

  return (
    <div className="@container min-w-0 space-y-3">
      {/* Chart Top Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-800">
            نمودار هندسی تابع و تجسم مراحل همگرایی
          </span>
          <span className="text-[11px] font-mono text-sky-700 bg-sky-50 wrap-anywhere px-2 py-0.5 rounded" dir="ltr">
            y = {expression}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => handleZoom(0.75)}
            className="inline-flex size-11 items-center justify-center p-1.5 text-slate-600 hover:text-slate-900 bg-white sm:pointer-fine:size-auto border border-slate-200 rounded-md hover:bg-slate-50 transition-colors cursor-pointer"
            title="بزرگ‌نمایی (Zoom In)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleZoom(1.33)}
            className="inline-flex size-11 items-center justify-center p-1.5 text-slate-600 hover:text-slate-900 bg-white sm:pointer-fine:size-auto border border-slate-200 rounded-md hover:bg-slate-50 transition-colors cursor-pointer"
            title="کوچک‌نمایی (Zoom Out)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={resetView}
            className="inline-flex size-11 items-center justify-center p-1.5 text-slate-600 hover:text-slate-900 bg-white sm:pointer-fine:size-auto border border-slate-200 rounded-md hover:bg-slate-50 transition-colors cursor-pointer"
            title="بازنشانی کادر"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* SVG Plot Canvas */}
      <div
        className="plot-surface relative h-[clamp(240px,55cqw,420px)] rounded-xl overflow-hidden border border-slate-200 shadow-inner select-none md:h-[clamp(300px,55cqw,420px)]"
      >
        <svg
          ref={plotRef}
          direction="ltr"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverCoord(null)}
          className="block w-full h-full cursor-crosshair"
        >
          {/* Grid lines */}
          <g stroke="#392954" strokeWidth="1" strokeDasharray="2,3">
            {xTicks.map((x) => {
              const sx = toSvgX(x);
              return <line key={`gx-${x}`} x1={sx} y1={0} x2={sx} y2={dimensions.height} />;
            })}
            {yTicks.map((y) => {
              const sy = toSvgY(y);
              return <line key={`gy-${y}`} x1={0} y1={sy} x2={dimensions.width} y2={sy} />;
            })}
          </g>

          {/* Coordinate Axes */}
          {/* X-Axis (y = 0) */}
          <line
            x1={0}
            y1={toSvgY(0)}
            x2={dimensions.width}
            y2={toSvgY(0)}
            stroke="#715b92"
            strokeWidth="1.5"
          />
          {/* Y-Axis (x = 0) */}
          <line
            x1={toSvgX(0)}
            y1={0}
            x2={toSvgX(0)}
            y2={dimensions.height}
            stroke="#715b92"
            strokeWidth="1.5"
          />

          {/* Axis Numerical Labels */}
          {xTicks.map((x) => {
            const sx = toSvgX(x);
            const sy = Math.min(dimensions.height - 8, Math.max(16, toSvgY(0) + 14));
            const label = Math.abs(x) < 1e-12 ? '0' : String(Number(x.toFixed(2)));
            const labelPadding = label.length * 3 + 3;
            return (
              <text
                key={`tx-${x}`}
                x={Math.max(labelPadding, Math.min(dimensions.width - labelPadding, sx))}
                y={sy}
                fill="#b9a8ce"
                fontSize="10"
                fontFamily="JetBrains Mono, monospace"
                textAnchor="middle"
              >
                {label}
              </text>
            );
          })}

          {yTicks.map((y) => {
            if (Math.abs(y) < 1e-12) return null; // skip 0 to prevent overlap
            const sy = toSvgY(y);
            const sx = Math.min(dimensions.width - 20, Math.max(20, toSvgX(0) + 6));
            return (
              <text
                key={`ty-${y}`}
                x={sx}
                y={Math.max(12, Math.min(dimensions.height - 4, sy + 3))}
                fill="#b9a8ce"
                fontSize="10"
                fontFamily="JetBrains Mono, monospace"
                textAnchor="start"
              >
                {Number(y.toFixed(2))}
              </text>
            );
          })}

          {/* Iteration Geometry Visualizations */}
          {activeStep === 0 && initial?.map((x, index) => (
            <g key={index} className="plot-initial">
              <line x1={toSvgX(x)} x2={toSvgX(x)} y1={0} y2={dimensions.height} stroke="currentColor" strokeDasharray="5 5" />
              <circle cx={toSvgX(x)} cy={toSvgY(0)} r={4} fill="currentColor" />
            </g>
          ))}
          {currentStep && (
            <g>
              {/* 1. Bisection: Bracket region [a, b] & midpoint c */}
              {'a' in currentStep && 'b' in currentStep && 'c' in currentStep && method === 'bisection' && (
                <>
                  <rect
                    x={toSvgX(currentStep.a)}
                    y={0}
                    width={Math.max(1, toSvgX(currentStep.b) - toSvgX(currentStep.a))}
                    height={dimensions.height}
                    fill="rgba(158, 107, 255, 0.16)"
                    stroke="rgba(158, 107, 255, 0.4)"
                    strokeWidth="1"
                    strokeDasharray="4,3"
                  />
                  {/* Midpoint line */}
                  <line
                    x1={toSvgX(currentStep.c)}
                    y1={toSvgY(0)}
                    x2={toSvgX(currentStep.c)}
                    y2={toSvgY(currentStep.fc)}
                    stroke="#c0a4ff"
                    strokeWidth="2"
                    strokeDasharray="2,2"
                  />
                  <circle
                    cx={toSvgX(currentStep.c)}
                    cy={toSvgY(currentStep.fc)}
                    r="5"
                    fill="#c0a4ff"
                  />
                </>
              )}

              {/* 2. Newton-Raphson: Tangent line from (xn, f(xn)) down to (xnNext, 0) */}
              {'xn' in currentStep && 'xnNext' in currentStep && method === 'newton' && (
                <>
                  {/* Tangent line */}
                  <line
                    x1={toSvgX(currentStep.xn)}
                    y1={toSvgY(currentStep.fxn)}
                    x2={toSvgX(currentStep.xnNext)}
                    y2={toSvgY(0)}
                    stroke="#f59e0b"
                    strokeWidth="2"
                  />
                  {/* Vertical drop line to xn */}
                  <line
                    x1={toSvgX(currentStep.xn)}
                    y1={toSvgY(0)}
                    x2={toSvgX(currentStep.xn)}
                    y2={toSvgY(currentStep.fxn)}
                    stroke="#f59e0b"
                    strokeWidth="1"
                    strokeDasharray="3,3"
                  />
                  <circle
                    cx={toSvgX(currentStep.xn)}
                    cy={toSvgY(currentStep.fxn)}
                    r="5"
                    fill="#f59e0b"
                  />
                  <circle
                    cx={toSvgX(currentStep.xnNext)}
                    cy={toSvgY(0)}
                    r="4"
                    fill="#c0a4ff"
                  />
                </>
              )}

              {/* 3. Secant Method: Secant line connecting (xPrev, f(xPrev)) & (xCurr, f(xCurr)) */}
              {'xPrev' in currentStep && 'xNext' in currentStep && method === 'secant' && (
                <>
                  <line
                    x1={toSvgX(currentStep.xPrev)}
                    y1={toSvgY(currentStep.fxPrev)}
                    x2={toSvgX(currentStep.xNext)}
                    y2={toSvgY(0)}
                    stroke="#a855f7"
                    strokeWidth="2"
                  />
                  <circle
                    cx={toSvgX(currentStep.xPrev)}
                    cy={toSvgY(currentStep.fxPrev)}
                    r="4"
                    fill="#c084fc"
                  />
                  <circle
                    cx={toSvgX(currentStep.xCurr)}
                    cy={toSvgY(currentStep.fxCurr)}
                    r="5"
                    fill="#a855f7"
                  />
                  <circle
                    cx={toSvgX(currentStep.xNext)}
                    cy={toSvgY(0)}
                    r="4"
                    fill="#c0a4ff"
                  />
                </>
              )}

              {/* 4. False Position: Chord connecting (a, f(a)) and (b, f(b)) */}
              {'a' in currentStep && 'b' in currentStep && 'c' in currentStep && method === 'falsePosition' && (
                <>
                  <line
                    x1={toSvgX(currentStep.a)}
                    y1={toSvgY(currentStep.fa)}
                    x2={toSvgX(currentStep.b)}
                    y2={toSvgY(currentStep.fb)}
                    stroke="#10b981"
                    strokeWidth="2"
                  />
                  <circle
                    cx={toSvgX(currentStep.a)}
                    cy={toSvgY(currentStep.fa)}
                    r="4"
                    fill="#10b981"
                  />
                  <circle
                    cx={toSvgX(currentStep.b)}
                    cy={toSvgY(currentStep.fb)}
                    r="4"
                    fill="#10b981"
                  />
                  <circle
                    cx={toSvgX(currentStep.c)}
                    cy={toSvgY(0)}
                    r="5"
                    fill="#c0a4ff"
                  />
                </>
              )}
            </g>
          )}

          {/* The Function Curve f(x) */}
          {curvePath && (
            <path
              d={curvePath}
              fill="none"
              stroke="#c0a4ff"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Final Root Marker */}
          {result?.status === 'converged' && result.root !== null && activeStep === lastStep && (
            <g>
              <circle
                cx={toSvgX(result.root)}
                cy={toSvgY(0)}
                r="7"
                fill="#ef4444"
                className="animate-pulse"
              />
              <circle
                cx={toSvgX(result.root)}
                cy={toSvgY(0)}
                r="3"
                fill="#ffffff"
              />
              <text
                x={toSvgX(result.root)}
                y={toSvgY(0) - 12}
                fill="#fca5a5"
                fontSize="11"
                fontWeight="bold"
                fontFamily="JetBrains Mono, monospace"
                textAnchor="middle"
              >
                x* ≈ {result.root.toFixed(4)}
              </text>
            </g>
          )}

          {/* Mouse Hover Indicator */}
          {hoverCoord && (
            <g pointerEvents="none">
              <circle cx={hoverCoord.px} cy={hoverCoord.py} r="4" fill="#fbbf24" />
              <rect
                x={Math.min(dimensions.width - 130, Math.max(10, hoverCoord.px - 60))}
                y={Math.max(10, hoverCoord.py - 35)}
                width="120"
                height="24"
                rx="4"
                fill="#1c1528"
                stroke="#715b92"
              />
              <text
                x={Math.min(dimensions.width - 70, Math.max(70, hoverCoord.px))}
                y={Math.max(26, hoverCoord.py - 19)}
                fill="#f1f5f9"
                fontSize="10"
                fontFamily="JetBrains Mono, monospace"
                textAnchor="middle"
              >
                ({hoverCoord.x.toFixed(3)}, {hoverCoord.y.toFixed(3)})
              </text>
            </g>
          )}
        </svg>

        {/* Legend */}
        <div className="absolute top-2.5 right-2.5 max-w-[calc(100%-1.25rem)] bg-white backdrop-blur-xs border border-slate-200 rounded-md px-2.5 py-1.5 text-[11px] text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-1">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-sky-400 inline-block rounded"></span>
            <span>منحنی f(x)</span>
          </div>
          {result?.status === 'converged' && result.root !== null && activeStep === lastStep && (
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
              <span>ریشه تقریبی</span>
            </div>
          )}
        </div>
      </div>

      {/* Step by Step Playback Controller */}
      {result && (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs sm:gap-y-3">
          <div className="flex w-full flex-wrap items-center justify-between gap-1 sm:w-auto sm:justify-start sm:gap-2">
            <button
              type="button"
              disabled={lastStep === 0}
              onClick={() => {
                if (!isPlaying && activeStep === lastStep) onStepChange(0);
                onPlayChange(!isPlaying);
              }}
              className="min-h-11 px-2 py-1.5 sm:pointer-fine:min-h-0 sm:pointer-fine:px-1.5 bg-sky-600 hover:bg-sky-700 active:scale-95 text-white rounded-md transition-all cursor-pointer flex items-center gap-1"
              title={isPlaying ? 'توقف پخش' : 'پخش خودکار مراحل'}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span className="text-[11px]">{isPlaying ? 'توقف' : 'پخش گام‌ها'}</span>
            </button>

            <button
              type="button"
              disabled={activeStep === 0}
              onClick={() => selectStep(activeStep - 1)}
              className="inline-flex size-11 items-center justify-center p-1.5 sm:pointer-fine:size-auto bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 rounded-md cursor-pointer"
              title="گام قبلی"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            <span className="font-mono text-slate-700 px-1 font-semibold">
              گام {activeStep} از {lastStep}
            </span>

            <button
              type="button"
              disabled={activeStep >= lastStep}
              onClick={() => selectStep(activeStep + 1)}
              className="inline-flex size-11 items-center justify-center p-1.5 sm:pointer-fine:size-auto bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 rounded-md cursor-pointer"
              title="گام بعدی"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>

          <button type="button" onClick={() => selectStep(0)} className="min-h-10 rounded-md px-2 text-sky-800" title="بازگشت به گام صفر">
            <RotateCcw className="inline size-4" /> شروع مجدد
          </button>
          {/* Slider */}
          <div className="w-full min-w-20 flex items-center gap-2 sm:max-w-xs sm:flex-1">
            <input
              type="range"
              min="0"
              max={lastStep}
              disabled={lastStep === 0}
              value={activeStep}
              onChange={(e) => selectStep(Number(e.target.value))}
              aria-label="انتخاب گام نمودار"
              className="w-full h-10 rounded-lg cursor-pointer sm:pointer-fine:h-5"
            />
          </div>

          <div className="text-[11px] text-slate-500">
            {method === 'bisection' && 'نمایش بازه و نقطه میانی'}
            {method === 'newton' && 'نمایش خط مماس و تقاطع با محور x'}
            {method === 'secant' && 'نمایش خط وتر دو نقطه قبلی'}
            {method === 'falsePosition' && 'نمایش وتر محصورکننده'}
          </div>
        </div>
      )}
    </div>
  );
};
