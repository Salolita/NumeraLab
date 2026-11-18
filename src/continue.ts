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
} else {
  portal({ action: 'redeem-login', ticket }).then(() => {
    location.replace(target === 'home' ? 'https://ieaum.ir/' : target === 'solver' ? '/'
      : target === 'presentation' ? '/erae-tori.html' : '/#panel');
  }).catch((error: Error) => { status.textContent = error.message; });
}
