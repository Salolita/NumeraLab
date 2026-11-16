import {createRoot} from 'react-dom/client';
import {useEffect, useState} from 'react';
import App from './App.tsx';
import type { Account } from './components/AccountPanel';
import { botLogin, entryGuide } from './utils/entry';
import { portal } from './utils/portal';
import './index.css';

function ServiceEntry() {
  const [account, setAccount] = useState<Account | null | undefined>();
  const [error, setError] = useState('');
  const entry = /^#panel(?:\/|$)/.test(location.hash) ? botLogin : 'https://t.me/ieaumbot?start=solver';
  useEffect(() => {
    portal<{ profile: Account | null }>().then(({ profile }) => setAccount(profile)).catch((failure: Error) => {
      setError(failure.message);
      setAccount(null);
    });
  }, []);

  if (account) return <App account={account} onLogout={() => setAccount(null)} />;
  return <main className="numralab mx-auto max-w-lg p-5 sm:p-8">
    <section className="solver-panel space-y-4 p-6">
      <div className="flex items-center gap-3">
        <a href="https://ieaum.ir/" aria-label="صفحهٔ اصلی IEAUM"><img src="/ieaum-logo.png" alt="" width="40" height="40" className="rounded-lg" /></a>
        <h1 className="text-xl font-black">نامرالب</h1>
      </div>
      {account === undefined ? <p role="status">در حال بررسی حساب…</p> : <>
        <p>{entryGuide}</p>
        {error && <p role="alert">{error}</p>}
        <a className="inline-block rounded-lg bg-sky-600 px-4 py-2 font-bold text-white" href={entry}>ادامه در ربات تلگرام</a>
      </>}
    </section>
  </main>;
}

createRoot(document.getElementById('root')!).render(<ServiceEntry />);
