const destination = new URL('https://ieaum.ir/erae-tori/');
destination.search = location.search;

const params = destination.searchParams;
const owner = params.get('admin');
const viewer = params.get('s');
try {
  const storageKey = owner ? `erae-admin-${owner}` : viewer ? `erae-viewer-${viewer}` : null;
  const access = storageKey && sessionStorage.getItem(storageKey);
  if (access && /^[\w-]{32}$/.test(access)) destination.hash = new URLSearchParams({ access }).toString();
} catch { /* Continue even when browser storage is unavailable. */ }

const link = document.querySelector<HTMLAnchorElement>('#destination');
if (link) link.href = destination.href;
location.replace(destination.href);
