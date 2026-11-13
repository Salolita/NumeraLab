import { useEffect, useState, type FormEvent } from 'react';
import { portal } from '../utils/portal';

interface Question { prompt: string; options: string[]; correct: number }
interface Quiz { id: string; title: string; content: Question[]; published: boolean; audience?: string[] }
interface Result { score: number; submitted_at: string; portal_profiles: { first_name: string; last_name: string } }
const input = 'w-full rounded-lg border border-slate-300 px-3 py-2';
const button = 'rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sky-950 disabled:opacity-50';

export function QuizPanel({ role }: { role: 'student' | 'teacher' }) {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [results, setResults] = useState<{ id: string; rows: Result[] }>();
  const [count, setCount] = useState(2);
  const [title, setTitle] = useState('');
  const [sample, setSample] = useState<'bisection' | 'matlab' | null>(null);
  const [editing, setEditing] = useState<Quiz | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [formVersion, setFormVersion] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const data = await portal<{ quizzes: Quiz[]; results: { quiz_id: string; score: number }[] }>({ action: 'quiz:list' });
    setQuizzes(data.quizzes);
    setScores(Object.fromEntries(data.results.map(({ quiz_id, score }) => [quiz_id, score])));
  }
  useEffect(() => { load().catch((error: Error) => setError(error.message)); }, []);

  async function perform(action: () => Promise<void>) {
    setError('');
    setNotice('');
    setBusy(true);
    try { await action(); } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }

  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const questions = Array.from({ length: count }, (_, index) => ({
      prompt: data.get(`prompt-${index}`),
      options: Array.from({ length: 4 }, (_, option) => data.get(`option-${index}-${option}`)),
      correct: Number(data.get(`correct-${index}`)),
    }));
    void perform(async () => {
      await portal({ action: editing ? 'quiz:update' : 'quiz:create', id: editing?.id, title, questions, audience: data.get('audience') });
      setNotice('پیش‌نویس ذخیره شد. برای نمایش به دانشجویان، دکمهٔ انتشار آزمون را بزنید.');
      setTitle(''); setSample(null); setEditing(null); setCount(2); setEditorOpen(false); setFormVersion((version) => version + 1);
      await load();
    });
  }

  const examples = [
    { prompt: 'برای x³ − x − 2 = 0، بازهٔ [1, 2] و نقطهٔ میانی 1.5 داده شده است. مقدار تابع در نقطهٔ میانی چند است؟', options: ['−0.125', '0.125', '−2', '4'] },
    { prompt: 'با توجه به f(1.5) = −0.125 و f(2) = 4، بازهٔ بعدی در روش دونیم‌سازی کدام است؟', options: ['[1.5, 2]', '[1, 1.5]', '[1, 2]', '[2, 2.5]'] },
  ];
  const matlabExample = { prompt: 'در روش دونیم‌سازی، کدام دستور MATLAB نقطهٔ میانی بازه را در c قرار می‌دهد؟',
    options: ['c = (a + b) / 2;', 'c = (b - a) / 2;', 'c = a + b / 2;', 'c = a * b / 2;'] };
  const template = editing?.content ?? (sample === 'matlab' ? [matlabExample] : sample === 'bisection' ? examples : []);
  return <section className="space-y-4" aria-labelledby="quiz-heading">
    <h2 id="quiz-heading" className="text-lg font-bold">آزمون‌های مرحله‌ای</h2>
    {error && <p role="alert" className="text-rose-700">{error}</p>}
    {notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-emerald-700">{notice}</p>}
    {role === 'teacher' && <details open={editorOpen} onToggle={(event) => setEditorOpen(event.currentTarget.open)} className="rounded-xl border border-slate-200 p-4">
      <summary className="cursor-pointer font-bold">{editing ? 'ویرایش پیش‌نویس' : 'ساخت آزمون جدید'}</summary>
      <form className="mt-4 space-y-4" onSubmit={create} key={formVersion}>
        <p className="text-sm text-slate-600">عنوان و نام‌های کاربری دانشجویان را وارد کنید. برای هر مرحله چهار گزینه و یک پاسخ درست تعیین کنید. پس از ذخیره، پیش‌نویس را منتشر کنید.</p>
        {!editing && <div className="flex flex-wrap gap-2">
        <button type="button" className={button} onClick={() => {
          setCount(2); setTitle('نمونهٔ دونیم‌سازی'); setSample('bisection'); setFormVersion((version) => version + 1);
        }}>بارگذاری نمونهٔ دونیم‌سازی</button>
        <button type="button" className={button + ' ms-2'} onClick={() => {
          setCount(1); setTitle('نمونهٔ MATLAB'); setSample('matlab'); setFormVersion((version) => version + 1);
        }}>بارگذاری نمونهٔ MATLAB</button>
        </div>}
        <label className="block">عنوان<input className={input} value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required /></label>
        <label className="block">نام‌های کاربری دانشجویان مجاز<textarea dir="ltr" name="audience" className={input} placeholder="student_1, student_2" maxLength={3300} defaultValue={editing?.audience?.join(', ')} required /></label>
        {Array.from({ length: count }, (_, index) => <fieldset className="space-y-2 rounded-lg bg-slate-50 p-3" key={index}>
          <legend>مرحلهٔ {index + 1}</legend>
          <label className="block">متن مرحله<textarea name={`prompt-${index}`} className={input} maxLength={1000} required defaultValue={template[index]?.prompt} /></label>
          <div className="grid gap-2 sm:grid-cols-2">{Array.from({ length: 4 }, (_, option) =>
            <label key={option}>گزینهٔ {option + 1}<input name={`option-${index}-${option}`} className={input} maxLength={200} required defaultValue={template[index]?.options[option]} /></label>)}</div>
          <label className="block">گزینهٔ صحیح<select className={input} name={`correct-${index}`} defaultValue={editing?.content[index]?.correct ?? 0}>{[0, 1, 2, 3].map((option) => <option value={option} key={option}>{option + 1}</option>)}</select></label>
        </fieldset>)}
        <div className="flex flex-wrap gap-2">
          <button type="button" className={button} disabled={count >= 15} onClick={() => setCount(count + 1)}>افزودن مرحله</button>
          <button type="button" className={button} disabled={count <= 1} onClick={() => setCount(count - 1)}>حذف مرحلهٔ آخر</button>
          <button className={button} disabled={busy}>ذخیرهٔ پیش‌نویس</button>
          {editing && <button type="button" className={button} onClick={() => {
            setEditing(null); setTitle(''); setCount(2); setFormVersion((version) => version + 1);
          }}>انصراف از ویرایش</button>}
        </div>
      </form>
    </details>}
    {quizzes.length === 0 && <p className="text-slate-600">آزمونی برای نمایش وجود ندارد.</p>}
    {quizzes.map((quiz) => <article key={quiz.id} className="space-y-3 rounded-xl border border-slate-200 p-4">
      <h3 className="font-bold">{quiz.title}</h3>
      {role === 'teacher' ? <>
        <p className="text-sm text-slate-600">{quiz.published ? 'منتشر شده' : 'پیش‌نویس'} · {quiz.audience?.length ?? 0} دانشجوی مجاز</p>
        <div className="flex flex-wrap gap-2">
          {!quiz.published && <>
            <button className={button} disabled={busy} onClick={() => {
              setEditing(quiz); setTitle(quiz.title); setSample(null); setCount(quiz.content.length); setFormVersion((version) => version + 1); setEditorOpen(true);
            }}>ویرایش پیش‌نویس</button>
            <button className={button} disabled={busy || editing?.id === quiz.id} onClick={() => void perform(async () => {
              await portal({ action: 'quiz:publish', id: quiz.id }); await load(); setNotice('آزمون برای دانشجویان مشخص‌شده منتشر شد.');
            })}>انتشار آزمون</button>
          </>}
          <button className={button} disabled={busy} onClick={() => void perform(async () => {
            const data = await portal<{ results: Result[] }>({ action: 'quiz:results', id: quiz.id });
            setResults({ id: quiz.id, rows: data.results });
          })}>مشاهدهٔ نتایج</button>
        </div>
        {results?.id === quiz.id && (results.rows.length ? <ul className="space-y-2 text-sm">
          {results.rows.map((row, index) => <li key={index}>{row.portal_profiles.first_name} {row.portal_profiles.last_name} · {row.score} از {quiz.content.length}</li>)}
        </ul> : <p>هنوز پاسخی ثبت نشده است.</p>)}
      </> : scores[quiz.id] !== undefined ? <p>نمرهٔ ثبت‌شده: {scores[quiz.id]} از {quiz.content.length}</p> :
        <form className="space-y-3" onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          void perform(async () => {
            const { score } = await portal<{ score: number }>({ action: 'quiz:submit', id: quiz.id, answers: quiz.content.map((_, index) => Number(data.get(`answer-${index}`))) });
            setScores((previous) => ({ ...previous, [quiz.id]: score }));
          });
        }}>
          {quiz.content.map((question, index) => <fieldset className="rounded-lg bg-slate-50 p-3" key={index}>
            <legend>{index + 1}. {question.prompt}</legend>
            {question.options.map((option, value) => <label className="my-2 flex items-center gap-2" key={value}><input type="radio" name={`answer-${index}`} value={value} required />{option}</label>)}
          </fieldset>)}
          <button className={button} disabled={busy}>ثبت پاسخ</button>
        </form>}
    </article>)}
  </section>;
}
