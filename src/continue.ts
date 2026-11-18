import { portal } from './utils/portal';
import { entryGuide } from './utils/entry';
import './index.css';

const url = new URL(location.href);
const ticket = url.hash.slice(1);
const target = url.searchParams.get('to');
const status = document.getElementById('status')!;
history.replaceState(null, '', url.pathname);

if (!ticket) {
  status.textContent = entryGuide;
} else if (target === 'presentation') {
  const destination = new URL('https://ieaum.ir/erae-tori/');
  destination.hash = new URLSearchParams({ ticket }).toString();
  location.replace(destination.href);
} else {
  portal({ action: 'redeem-login', ticket }).then(() => {
    location.replace(target === 'home' ? 'https://ieaum.ir/' : target === 'solver' ? '/' : '/#panel');
  }).catch((error: Error) => { status.textContent = error.message; });
}
