import { createRoot } from 'react-dom/client';
import { useState, type FormEvent } from 'react';
import { portal } from './utils/portal';
import { botLogin, entryGuide, welcomeText } from './utils/entry';
import './index.css';

const telegram = (window as Window & {
  Telegram?: { WebApp?: { initData: string; ready(): void; expand(): void; close(): void; openLink(url: string): void } };
}).Telegram?.WebApp;
const requestedRole = new URLSearchParams(location.search).get('role');
const role = requestedRole === 'teacher' ? 'teacher' : 'student';
const params = new URLSearchParams(location.search);
const loginMode = ['login', 'link'].includes(params.get('mode') ?? '');
const field = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2';
const button = 'rounded-lg bg-sky-600 px-4 py-2 font-bold text-white disabled:opacity-50';
telegram?.ready();
if (telegram?.initData) telegram.expand();

function Register() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [notified, setNotified] = useState(true);
  const [nextUrl, setNextUrl] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setError('');
    try {
      const result = await portal<{ notified?: boolean; nextUrl?: string }>({
        ...Object.fromEntries(new FormData(form)), action: loginMode ? 'login' : 'register',
        role, target: params.get('to'), telegramInitData: telegram?.initData,
      });
      setNotified(result.notified !== false);
      setNextUrl(result.nextUrl ?? '');
      form.reset();
      setSuccess(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'درخواست انجام نشد.');
    } finally { setBusy(false); }
  }

  return <main className="numralab mx-auto max-w-lg p-4 sm:p-6">
    <section className="solver-panel space-y-4 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <img src="/ieaum-logo.png" alt="" width="40" height="40" className="rounded-lg" />
        <h1 className="text-xl font-black">{loginMode ? 'ورود به حساب' : role === 'teacher' ? 'ساخت حساب استاد' : 'ساخت حساب دانشجو'}</h1>
      </div>
      {!telegram?.initData ? <>
        <p>{entryGuide}</p>
        <a className={button + ' inline-block'} href={loginMode ? botLogin : `https://t.me/ieaumbot?start=${role}`}>باز کردن ربات تلگرام</a>
      </> : success ? <>
        <p role="status" className="whitespace-pre-line rounded-lg bg-emerald-50 p-3 text-emerald-700">{loginMode ? welcomeText : 'درخواست ثبت شد و در انتظار تأیید مدیر است. پس از تأیید، ورود را از ربات انجام دهید.'}</p>
        {!notified && <p className="text-sm text-slate-600">ارسال اعلان تلگرام انجام نشد.</p>}
        {loginMode ? <button type="button" className={button} onClick={() => telegram.openLink(nextUrl)}>بزن بریم!</button>
          : <button type="button" className={button} onClick={() => telegram.close()}>بازگشت به ربات</button>}
      </> : <form className="space-y-3" onSubmit={submit}>
        {!loginMode && <>
        {role === 'student' && <p className="rounded-lg bg-sky-50 p-3 text-sm text-sky-900">ویژهٔ دانشجویان ورودی ۴۰۴. حساب پس از تأیید مدیر فعال می‌شود.</p>}
        {role === 'teacher' && <p className="text-sm text-slate-600">حساب پس از تأیید مدیر فعال می‌شود.</p>}
        <div className="grid grid-cols-2 gap-3">
          <label>نام<input name="firstName" autoComplete="given-name" maxLength={80} required className={field} /></label>
          <label>نام خانوادگی<input name="lastName" autoComplete="family-name" maxLength={80} required className={field} /></label>
        </div>
        {role === 'student' ? <>
          <label className="block">شمارهٔ دانشجویی<input name="studentNumber" dir="ltr" inputMode="numeric" maxLength={20} required className={field} /></label>
          <label className="block">تاریخ تولد (میلادی)<input name="birthDate" type="date" autoComplete="bday" required className={field} /></label>
        </> : <label className="block">نام درس<input name="courseName" maxLength={120} required className={field} /></label>}
        <label className="block">شمارهٔ تماس<input name="phone" type="tel" dir="ltr" autoComplete="tel" maxLength={24} required className={field} /></label>
        </>}
        <label className="block">نام کاربری<input name="username" dir="ltr" autoComplete="username" minLength={3} maxLength={32} required className={field} /></label>
        <label className="block">رمز عبور<input name="password" type="password" dir="ltr" autoComplete={loginMode ? 'current-password' : 'new-password'} minLength={12} maxLength={72} required className={field} /></label>
        <p className="text-sm text-slate-600">نام کاربری انگلیسی و رمز حداقل ۱۲ نویسه باشد.</p>
        {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-rose-700">{error}</p>}
        <button className={button} disabled={busy}>{busy ? 'در حال ارسال…' : loginMode ? 'ورود' : 'ارسال درخواست'}</button>
      </form>}
    </section>
  </main>;
}

createRoot(document.getElementById('root')!).render(<Register />);
