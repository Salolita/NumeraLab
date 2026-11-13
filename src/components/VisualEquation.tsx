import { useEffect, useRef, useState } from 'react';
import type { MathfieldElement } from 'mathlive';
import { compileExpression } from '../utils/mathParser';

export function VisualEquation({ onApply }: { onApply: (value: string) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const math = useRef<MathfieldElement | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let disposed = false;
    void import('mathlive').then(({ MathfieldElement }) => {
      if (disposed || !host.current) return;
      const field = new MathfieldElement();
      field.setAttribute('aria-label', 'فرمول ریاضی');
      field.mathVirtualKeyboardPolicy = 'manual';
      host.current.replaceChildren(field);
      math.current = field;
      setReady(true);
    }).catch(() => { if (!disposed) setError('ویرایشگر باز نشد. از ورودی متنی استفاده کنید.'); });
    return () => { disposed = true; math.current?.remove(); math.current = null; };
  }, []);

  const keys = [
    { label: 'کسر', latex: '\\frac{#@}{#?}' },
    { label: 'توان', latex: '#@^{#?}' },
    { label: 'رادیکال', latex: '\\sqrt{#0}' },
    { label: 'لگاریتم', latex: '\\ln\\left(#0\\right)' },
    { label: 'سینوس', latex: '\\sin\\left(#0\\right)' },
    { label: 'پرانتز', latex: '\\left(#0\\right)' },
  ];
  function apply() {
    const field = math.current;
    if (!field) return;
    const expression = field.getValue('ascii-math');
    const validation = compileExpression(expression);
    if (!validation.fn) { setError(validation.error ?? 'فرمول معتبر نیست.'); return; }
    setError('');
    onApply(expression);
  }
  return <div className="mt-3 space-y-3">
    <label className="block text-sm">توضیح صورت مسئله (اختیاری)<textarea className="mt-1 w-full rounded-lg bg-slate-50 p-2" maxLength={1500} rows={2} /></label>
    <div ref={host} className="math-editor" dir="ltr" />
    <div className="flex flex-wrap gap-2">
      {keys.map(({ label, latex }) => <button type="button" key={label} disabled={!ready} className="rounded-lg bg-slate-100 px-2 py-1 text-sm"
        onClick={() => { math.current?.focus(); math.current?.insert(latex); }}>{label}</button>)}
      <button type="button" disabled={!ready} className="rounded-lg bg-sky-600 px-3 py-1 text-sm text-white" onClick={apply}>استفاده از فرمول</button>
    </div>
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
  </div>;
}
