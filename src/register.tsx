import { createRoot } from 'react-dom/client';
import { useState, type FormEvent } from 'react';
import { portal } from './utils/portal';
import './index.css';

const telegram = (window as Window & {
  Telegram?: { WebApp?: { initData: string; ready(): void; expand(): void; close(): void } };
}).Telegram?.WebApp;
const requestedRole = new URLSearchParams(location.search).get('role');
const role = requestedRole === 'teacher' ? 'teacher' : 'student';
const linkMode = new URLSearchParams(location.search).get('mode') === 'link';
const field = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2';
const button = 'rounded-lg bg-sky-600 px-4 py-2 font-bold text-white disabled:opacity-50';
telegram?.ready();
if (telegram?.initData) telegram.expand();

function Register() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [notified, setNotified] = useState(true);
  const [status, setStatus] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setError('');
    try {
      const result = await portal<{ notified?: boolean; status?: string }>({ ...Object.fromEntries(new FormData(form)), action: linkMode ? 'link-telegram' : 'register', role, telegramInitData: telegram?.initData });
      setNotified(result.notified !== false);
      setStatus(result.status ?? '');
      form.reset();
      setSuccess(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'ساخت حساب انجام نشد.');
    } finally { setBusy(false); }
  }

  return <main className="numralab mx-auto max-w-lg p-4 sm:p-6">
    <section className="solver-panel space-y-4 p-4 sm:p-6">
      <h1 className="text-xl font-black">{linkMode ? 'اتصال حساب به تلگرام' : role === 'teacher' ? 'ساخت حساب استاد' : 'ساخت حساب دانشجو'}</h1>
      {linkMode && !telegram?.initData ? <a className={button + ' inline-block'} href="https://t.me/ieaumbot?start=link">باز کردن ربات نامرالب</a> : success ? <>
        <p role="status" className="rounded-lg bg-emerald-50 p-3 text-emerald-700">{linkMode ? `حساب متصل شد. ${status}` : 'درخواست ثبت شد و در انتظار تأیید مدیر است. پس از تأیید می‌توانید از سایت وارد شوید.'}</p>
        {!notified && <p className="text-sm text-slate-600">ارسال اعلان تلگرام انجام نشد.</p>}
        {!linkMode && !telegram?.initData && <a className="block underline" href="https://t.me/ieaumbot?start=link">اتصال تلگرام برای دریافت نتیجهٔ تأیید</a>}
        {telegram?.initData ? <button type="button" className={button} onClick={() => telegram.close()}>بازگشت به ربات</button>
          : <a className={button + ' inline-block'} href="/#panel">رفتن به صفحهٔ ورود</a>}
      </> : <form className="space-y-3" onSubmit={submit}>
        {!linkMode && <>
        {!telegram?.initData && <p className="text-sm">برای دریافت اعلان، حساب را با گزینهٔ «وضعیت حساب و اتصال تلگرام» در <a className="underline" href="https://t.me/ieaumbot?start=link">ربات نامرالب</a> متصل کنید.</p>}
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
        <label className="block">رمز عبور<input name="password" type="password" dir="ltr" autoComplete={linkMode ? 'current-password' : 'new-password'} minLength={12} maxLength={72} required className={field} /></label>
        <p className="text-sm text-slate-600">نام کاربری انگلیسی و رمز حداقل ۱۲ نویسه باشد.</p>
        {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-rose-700">{error}</p>}
        <button className={button} disabled={busy}>{busy ? 'در حال ارسال…' : linkMode ? 'اتصال حساب' : 'ارسال درخواست'}</button>
      </form>}
    </section>
  </main>;
}

createRoot(document.getElementById('root')!).render(<Register />);
