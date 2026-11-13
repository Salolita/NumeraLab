import { useEffect, useState, type FormEvent } from 'react';
import { QuizPanel } from './QuizPanel';
import { portal } from '../utils/portal';

export interface Account { username: string; first_name: string; last_name: string; role: 'student' | 'teacher' }
const bot = 'https://t.me/ieaumbot';
const fields = 'w-full rounded-lg border border-slate-300 px-3 py-2';
const button = 'rounded-lg bg-sky-600 px-4 py-2 font-bold text-white disabled:opacity-50';

export function AccountPanel() {
  const [account, setAccount] = useState<Account | null>(null);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (location.hash.startsWith('#panel/')) history.replaceState(null, '', location.pathname + location.search + '#panel');
    let current = true;
    portal<{ profile: Account | null; enabled: boolean }>().then((data) => {
      if (current) { setAccount(data.profile); setEnabled(data.enabled); }
    }).catch((error: Error) => { if (current) { setEnabled(false); setError(error.message); } });
    return () => { current = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    setError('');
    setBusy(true);
    try {
      await portal({ ...values, action: 'login' });
      form.reset();
      const { profile } = await portal<{ profile: Account | null }>();
      if (!profile) throw new Error('نشست ورود برقرار نشد. دوباره وارد شوید.');
      setAccount(profile);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'درخواست انجام نشد.');
    } finally { setBusy(false); }
  }

  return <section className="solver-panel mx-auto max-w-3xl space-y-5 p-5 sm:p-8">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-xl font-black">{account ? (account.role === 'teacher' ? 'پنل مدیریت آزمون استاد' : 'پنل دانشجو') : 'ورود به پنل نامرالب'}</h1>
      {account && <button type="button" className="rounded-lg border border-slate-300 px-3 py-1" onClick={async () => {
        try { await portal({ action: 'logout' }); setAccount(null); }
        catch (error) { setError((error as Error).message); }
      }}>خروج</button>}
    </div>
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-rose-700">{error}</p>}
    {account ? <>
      <p className="text-slate-600">{account.first_name} {account.last_name} · <bdi>{account.username}</bdi></p>
      <QuizPanel role={account.role} />
    </> : enabled === null ? <p>در حال بررسی وضعیت پنل…</p> : !enabled ? (
      <p className="text-slate-600">سامانهٔ حساب‌ها هنوز فعال نشده است.</p>
    ) : (
      <>
      <form className="space-y-4" onSubmit={submit}>
        <label className="block">نام کاربری<input name="username" dir="ltr" autoComplete="username" minLength={3} maxLength={32} required className={fields} /></label>
        <label className="block">رمز عبور<input name="password" type="password" dir="ltr" autoComplete="current-password" minLength={12} maxLength={72} required className={fields} /></label>
        <button className={button} disabled={busy}>{busy ? 'در حال ورود…' : 'ورود'}</button>
      </form>
      <div className="flex flex-wrap gap-4 border-t border-slate-200 pt-4 text-sm">
        <a className="font-bold text-sky-800" href={bot + '?start=student'}>ثبت‌نام دانشجو (ورودی ۴۰۴) ↗</a>
        <a className="font-bold text-sky-800" href={bot + '?start=teacher'}>فعال‌سازی حساب استاد ↗</a>
      </div>
      </>
    )}
  </section>;
}
