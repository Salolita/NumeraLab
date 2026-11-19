import {createRoot} from 'react-dom/client';
import {useEffect, useState, type FormEvent} from 'react';
import App from './App.tsx';
import { botReset, botSignup } from './utils/entry';
import { portal } from './utils/portal';
import { telegramLaunchData } from './utils/telegram-launch';
import './index.css';

interface Account { id: string }
const ticketFromBot = new URLSearchParams(location.hash.slice(1)).get('ticket');
if (ticketFromBot) history.replaceState(null, '', location.pathname + location.search);

async function loadAccount() {
  if (ticketFromBot) await portal({ action: 'redeem-login', ticket: ticketFromBot }).catch(() => {});
  const { profile } = await portal<{ profile: Account | null }>();
  if (profile || location.hostname !== 'numeralab.ieaum.ir') return profile;
  try {
    const response = await fetch('https://ieaum.ir/api/account?transfer=site', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: '{}', signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const { ticket } = await response.json() as { ticket: string };
    await portal({ action: 'redeem-login', ticket });
    return (await portal<{ profile: Account | null }>()).profile;
  } catch {
    return null;
  }
}

function ServiceEntry() {
  const [account, setAccount] = useState<Account | null | undefined>();
  const [error, setError] = useState('');
  const [loginOpen, setLoginOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const button = 'inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2 font-bold disabled:opacity-50';
  const input = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2';
  useEffect(() => {
    loadAccount().then(setAccount).catch((failure: Error) => {
      setError(failure.message);
      setAccount(null);
    });
  }, []);

  useEffect(() => {
    if (account && !ticketFromBot) void portal({ action: 'service:opened', target: 'solver' }).catch(() => {});
  }, [account]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setError('');
    try {
      await portal({ action: 'login', ...Object.fromEntries(new FormData(form)) });
      const { profile } = await portal<{ profile: Account | null }>();
      if (!profile) throw new Error('نشست برقرار نشد. دوباره وارد شوید.');
      form.reset();
      setAccount(profile);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (account) return <App />;
  return <div className="grid min-h-dvh place-items-center px-4 py-6 sm:px-6">
    <main className="numralab w-full max-w-2xl rounded-3xl p-4 sm:p-10">
      <section className="solver-panel space-y-5 p-5 sm:p-7">
      <div className="flex items-center gap-3">
        <a href="https://ieaum.ir/" aria-label="صفحهٔ اصلی IEAUM"><img src="/ieaum-logo.png" alt="" width="40" height="40" className="rounded-lg" /></a>
        <h1 className="text-xl font-black">نامرالب</h1>
      </div>
        {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-rose-700">{error}</p>}
        {account === undefined ? <p role="status">در حال بررسی حساب…</p> : loginOpen ? <form className="space-y-4" onSubmit={login}>
          <label className="block">نام کاربری<input autoFocus name="username" dir="ltr" autoComplete="username" required maxLength={32} className={input} /></label>
          <label className="block">رمز عبور<input name="password" type="password" dir="ltr" autoComplete="current-password" required maxLength={72} className={input} /></label>
          <div className="flex flex-wrap items-center gap-3">
            <button className={button + ' bg-sky-600 text-white'} disabled={busy}>{busy ? 'در حال ورود…' : 'ورود'}</button>
            <a href={botReset} className="px-2 py-2 text-sky-800 underline">فراموشی رمز عبور</a>
            <button type="button" className="px-2 py-2" disabled={busy} onClick={() => { setError(''); setLoginOpen(false); }}>بازگشت</button>
          </div>
        </form> : <>
          <p>برای استفاده از نامرالب، وارد حساب خود شوید یا از ربات تلگرام حساب بسازید.</p>
          <div className="flex flex-wrap gap-3">
            <button type="button" className={button + ' bg-sky-600 text-white'} onClick={() => setLoginOpen(true)}>ورود</button>
            <a className={button + ' border border-slate-300'} href={botSignup}>افتتاح حساب کاربری</a>
          </div>
        </>}
      </section>
    </main>
  </div>;
}

if (/^#panel(?:\/|$)/.test(location.hash)) {
  location.replace('https://ieaum.ir/panel/');
} else if (telegramLaunchData(location.hash)) {
  // Some clients open the bot's main Mini App at the site's root.
  location.replace('/register.html' + location.hash);
} else {
  createRoot(document.getElementById('root')!).render(<ServiceEntry />);
}
