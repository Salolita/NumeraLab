import { useEffect, useState, type FormEvent } from 'react';
import { QuizPanel } from './QuizPanel';
import { portal } from '../utils/portal';

export interface Account { username: string; first_name: string; last_name: string; role: 'student' | 'teacher' }
const bot = 'https://t.me/ieaumbot';
const fields = 'w-full rounded-lg border border-slate-300 px-3 py-2';
const button = 'rounded-lg bg-sky-600 px-4 py-2 font-bold text-white disabled:opacity-50';

export function AccountPanel() {
  const [link] = useState(() => location.hash.match(/^#panel\/(student|teacher|login)\/([A-Za-z0-9_-]{32})$/));
  const [account, setAccount] = useState<Account | null>(null);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [finished, setFinished] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const mode = link?.[1];
  const registering = mode === 'student' || mode === 'teacher';
  useEffect(() => {
    if (link) history.replaceState(null, '', location.pathname + location.search + '#panel');
    portal<{ profile: Account | null; enabled: boolean }>().then((data) => {
      setAccount(data.profile);
      setEnabled(data.enabled);
    }).catch((error: Error) => { setEnabled(false); setError(error.message); });
  }, [link]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    setError('');
    setBusy(true);
    try {
      await portal({ ...values, action: registering ? 'register' : 'login', ticket: link?.[2] });
      form.reset();
      if (registering) setFinished(true);
      else setAccount((await portal<{ profile: Account }>()).profile);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'درخواست انجام نشد.');
    } finally { setBusy(false); }
  }

  return <section className="solver-panel mx-auto max-w-3xl space-y-5 p-5 sm:p-8">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-xl font-black">{account ? (account.role === 'teacher' ? 'پنل استاد' : 'پنل دانشجو') : registering ? 'ساخت حساب' : 'ورود به پنل'}</h1>
      {account && <button type="button" className="rounded-lg border border-slate-300 px-3 py-1" onClick={async () => {
        try { await portal({ action: 'logout' }); setAccount(null); setFinished(true); }
        catch (error) { setError((error as Error).message); }
      }}>خروج</button>}
    </div>
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-rose-700">{error}</p>}
    {account ? <>
      <p className="text-slate-600">{account.first_name} {account.last_name}</p>
      <QuizPanel role={account.role} />
    </> : enabled === null ? <p>در حال بررسی وضعیت پنل…</p> : !enabled ? (
      <p className="text-slate-600">سامانهٔ حساب‌ها هنوز فعال نشده است.</p>
    ) : link && !finished ? (
      <form className="space-y-4" onSubmit={submit}>
        {mode === 'student' && <p className="rounded-lg bg-sky-50 p-3 text-sky-900">این پنل برای دانشجویان ورودی ۴۰۴ طراحی شده است.</p>}
        {registering && <div className="grid gap-3 sm:grid-cols-2">
          <label>نام<input name="firstName" autoComplete="given-name" maxLength={80} required className={fields} /></label>
          <label>نام خانوادگی<input name="lastName" autoComplete="family-name" maxLength={80} required className={fields} /></label>
          {mode === 'student' && <>
            <label>شمارهٔ دانشجویی<input name="studentNumber" inputMode="numeric" dir="ltr" maxLength={20} required className={fields} /></label>
            <label>تاریخ تولد (میلادی)<input name="birthDate" type="date" autoComplete="bday" required className={fields} /></label>
          </>}
        </div>}
        <label className="block">نام کاربری<input name="username" dir="ltr" autoComplete="username" minLength={3} maxLength={32} required className={fields} /></label>
        <label className="block">رمز عبور<input name="password" type="password" dir="ltr" autoComplete={registering ? 'new-password' : 'current-password'} minLength={12} maxLength={72} required className={fields} /></label>
        {registering && <p className="text-sm text-slate-600">نام کاربری را انگلیسی و رمز را حداقل ۱۲ نویسه انتخاب کنید.</p>}
        <button className={button} disabled={busy}>{busy ? 'در حال ارسال…' : registering ? 'ساخت حساب' : 'ورود'}</button>
      </form>
    ) : <>
      <p className="text-slate-600">{finished && registering ? 'حساب ساخته شد. برای دریافت لینک ورود، دستور /panel را در ربات بفرستید.' : 'برای ورود، دستور /panel را در ربات بفرستید. برای ثبت‌نام، دعوت یک‌بارمصرف را از مدیر گروه بگیرید.'}</p>
      <a className={button + ' inline-block'} href={bot}>باز کردن ربات تلگرام ↗</a>
    </>}
  </section>;
}
