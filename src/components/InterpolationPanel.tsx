import { useEffect, useRef, useState, type FormEvent } from 'react';
import { interpolate } from '../utils/interpolation';
import { normalizeDigits } from '../utils/mathParser';

const format = (value: number) => String(Number(value.toPrecision(10)));
const numeric = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
function parseNumber(value: string) {
  const normalized = normalizeDigits(value.trim());
  return numeric.test(normalized) ? Number(normalized) : NaN;
}

export function InterpolationPanel() {
  const [table, setTable] = useState('۰\t۱\n۱\t۳\n۲\t۷');
  const [target, setTarget] = useState('۱٫۵');
  const [result, setResult] = useState<ReturnType<typeof interpolate>>();
  const [error, setError] = useState('');
  const [scan, setScan] = useState('');
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [matlabInput, setMatlabInput] = useState<{ x: number[]; y: number[]; t: number }>();
  const [matlabOutput, setMatlabOutput] = useState<{ value: number; terms: number[] }>();
  const [matlabAvailable, setMatlabAvailable] = useState(false);
  const [runningMatlab, setRunningMatlab] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => { fetch('/api/matlab').then((response) => response.json()).then((data) => setMatlabAvailable(data.enabled === true)).catch(() => {}); }, []);

  async function runMatlab() {
    setRunningMatlab(true); setMatlabOutput(undefined); setError('');
    try {
      const response = await fetch('/api/matlab', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(matlabInput),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMatlabOutput(data);
    } catch (error) { setError((error as Error).message); }
    finally { setRunningMatlab(false); }
  }

  function solve(event: FormEvent) {
    event.preventDefault();
    setError(''); setResult(undefined); setCode(''); setMatlabInput(undefined); setMatlabOutput(undefined);
    try {
      const points = table.trim().split(/\r?\n/).filter((line) => line.trim()).map((line) => {
        const cells = line.trim().split(/[\s,،;]+/);
        if (cells.length !== 2) throw new Error('در هر سطر دقیقاً دو عدد x و y وارد کنید.');
        return { x: parseNumber(cells[0]), y: parseNumber(cells[1]) };
      });
      const at = parseNumber(target);
      if (!Number.isFinite(at)) throw new Error('نقطهٔ ارزیابی را به‌صورت عددی وارد کنید.');
      setResult(interpolate(points, at));
      setMatlabInput({ x: points.map(({ x }) => x), y: points.map(({ y }) => y), t: at });
      setCode([
        `x = [${points.map(({ x }) => x).join(' ')}];`,
        `c = [${points.map(({ y }) => y).join(' ')}];`,
        `t = ${at};`,
        'n = numel(x);',
        'for k = 2:n',
        '    for j = n:-1:k',
        '        c(j) = (c(j)-c(j-1))/(x(j)-x(j-k+1));',
        '    end',
        'end',
        'terms = zeros(1,n);',
        'terms(1) = c(1);',
        'for k = 2:n',
        '    terms(k) = c(k)*prod(t-x(1:k-1));',
        'end',
        "disp(table(c(:),terms(:),'VariableNames',{'Coefficient','Term'}));",
        'fprintf("p(t) = %.12g\\n",sum(terms));',
      ].join('\n'));
    } catch (error) { setError((error as Error).message); }
  }

  async function scanTable(file: File) {
    setError(''); setScan('');
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) {
      setError('یک تصویر PNG، JPEG یا WebP تا ۸ مگابایت انتخاب کنید.');
      return;
    }
    setBusy(true);
    try {
      const image = await createImageBitmap(file);
      if (image.width * image.height > 18_000_000) {
        image.close();
        throw new Error('ابعاد تصویر بزرگ است. بخش جدول را برش دهید.');
      }
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 2400 / Math.max(image.width, image.height));
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d');
      if (!context) { image.close(); throw new Error('خواندن تصویر در این مرورگر ممکن نیست.'); }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      image.close();
      const { createWorker, PSM } = await import('tesseract.js');
      const worker = await createWorker(['eng', 'fas']);
      try {
        await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
        const { data } = await worker.recognize(canvas);
        const lines = normalizeDigits(data.text).split(/\r?\n/).filter((line) => line.trim());
        const pairs = lines.map((line) => line.trim().split(/[\s,،;|]+/).filter((value) => numeric.test(value)));
        setScan(pairs.length >= 2 && pairs.every((row) => row.length === 2)
          ? pairs.map((row) => row.join('\t')).join('\n') : lines.join('\n'));
        if (!lines.length) setError('متنی پیدا نشد. تصویری واضح و برش‌خورده از جدول انتخاب کنید.');
      } finally { await worker.terminate(); }
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }

  return <section className="solver-panel mx-auto max-w-4xl space-y-5 p-5 sm:p-8">
    <h1 className="text-xl font-black">درون‌یابی و برون‌یابی نیوتن</h1>
    <p className="text-sm text-slate-600">در هر سطر، x و y را با فاصله یا تب جدا کنید. ضرایب تفاضلات تقسیم‌شده و حاصل هر جمله در نقطهٔ خواسته‌شده نمایش داده می‌شود.</p>
    <div>
      <input ref={fileInput} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => {
        const file = event.target.files?.[0]; event.target.value = ''; if (file) void scanTable(file);
      }} />
      <button type="button" disabled={busy} className="rounded-lg border border-slate-300 px-3 py-2" onClick={() => fileInput.current?.click()}>{busy ? 'در حال خواندن تصویر…' : 'خواندن جدول از تصویر'}</button>
      {scan && <div className="mt-3 space-y-2">
        <label className="block">متن استخراج‌شده را بازبینی و اصلاح کنید<textarea dir="ltr" rows={4} value={scan} onChange={(event) => setScan(event.target.value)} className="mt-2 w-full rounded-lg bg-slate-50 p-3 font-mono" /></label>
        <button type="button" disabled={runningMatlab} className="rounded-lg bg-sky-50 px-3 py-2 text-sky-950" onClick={() => { setTable(scan); setScan(''); setResult(undefined); setCode(''); setMatlabInput(undefined); setMatlabOutput(undefined); }}>انتقال به جدول</button>
      </div>}
    </div>
    <form onSubmit={solve} className="space-y-4">
      <label className="block">داده‌های x و y<textarea dir="ltr" rows={4} value={table} onChange={(event) => setTable(event.target.value)} required className="mt-2 w-full rounded-lg bg-slate-50 p-3 font-mono" /></label>
      <label className="block">نقطهٔ ارزیابی<input dir="ltr" value={target} onChange={(event) => setTarget(event.target.value)} required className="ms-3 max-w-36 rounded-lg border border-slate-300 px-3 py-2" /></label>
      <button disabled={runningMatlab} className="rounded-lg bg-sky-600 px-4 py-2 font-bold text-white">محاسبه</button>
    </form>
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-rose-700">{error}</p>}
    {result && <>
      <p className="rounded-lg bg-sky-50 p-3 text-sky-950">{result.outside ? 'برون‌یابی' : 'درون‌یابی'} · <bdi>p(x) ≈ {format(result.value)}</bdi></p>
      <ol className="space-y-2">{result.terms.map((term, index) => <li key={index} className="rounded-lg bg-slate-50 p-3">
        جملهٔ {index + 1}<span className="solution-equation" dir="ltr">{[format(term.coefficient), ...term.offsets.map((offset) => `(${format(offset)})`)].join(' × ')} ≈ {format(term.value)}</span>
      </li>)}</ol>
      <details><summary className="cursor-pointer">کد MATLAB برای همین داده‌ها</summary>
        <p className="mt-2 text-sm text-slate-600">کد را در MATLAB اجرا کنید. عدد بالا از حل‌گر نامرالب به دست آمده است.</p>
        <pre dir="ltr" className="mt-3 overflow-x-auto rounded-lg bg-slate-50 p-3 text-xs">{code}</pre>
        <a className="mt-2 inline-block text-sky-800" download="numralab_interpolation.m" href={'data:text/plain;charset=utf-8,' + encodeURIComponent(code)}>دانلود فایل MATLAB</a>
        {matlabAvailable && <button type="button" disabled={runningMatlab} className="ms-3 rounded-lg bg-sky-600 px-3 py-2 text-white"
          onClick={() => void runMatlab()}>{runningMatlab ? 'در حال اجرا…' : 'اجرای واقعی MATLAB'}</button>}
        {matlabOutput && <div className="mt-3 rounded-lg bg-sky-50 p-3 text-sky-950">
          <p>خروجی MATLAB <bdi>{format(matlabOutput.value)}</bdi></p>
          <p>اختلاف مطلق با نامرالب <bdi>{format(Math.abs(matlabOutput.value - result.value))}</bdi></p>
          <p>جمله‌ها <bdi>{matlabOutput.terms.map(format).join(', ')}</bdi></p>
        </div>}
      </details>
    </>}
  </section>;
}
