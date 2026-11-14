import { equalSecret, limit, PortalError, query, readBody, reply, setting } from './portal-store.js';
import { admins, decideReview, pendingReviews, type ReviewCallback } from './account-review.js';

const labels = {
  login: 'ورود به پنل', student: 'ساخت حساب دانشجو', teacher: 'ساخت حساب استاد', legacyTeacher: 'فعال‌سازی حساب استاد',
  id: 'شناسهٔ تلگرام من', help: 'راهنما', inviteStudent: 'دعوت دانشجو', inviteTeacher: 'دعوت استاد',
};

type Markup = { keyboard: { text: string }[][]; resize_keyboard: boolean; is_persistent: boolean }
  | { inline_keyboard: ({ text: string; url: string } | { text: string; web_app: { url: string } })[][] };

const linkButton = (text: string, url: string): Markup => ({ inline_keyboard: [[{ text, url }]] });
const signupButton = (role: 'student' | 'teacher') => ({
  text: labels[role],
  web_app: { url: new URL(`/register.html?role=${role}`, setting('PORTAL_ORIGIN')).href },
});

async function send(chatId: string, message: string, markup?: Markup) {
  const response = await fetch(`https://api.telegram.org/bot${setting('TELEGRAM_BOT_TOKEN')}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: message, reply_markup: markup, link_preview_options: { is_disabled: true } }),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new PortalError(502, 'ارسال پیام تلگرام انجام نشد.');
}

export async function telegramWebhook(request: Request) {
  if (!equalSecret(request.headers.get('x-telegram-bot-api-secret-token') ?? '', setting('TELEGRAM_WEBHOOK_SECRET'))) {
    throw new PortalError(403, 'درخواست معتبر نیست.');
  }
  const update = await readBody(request);
  if (update.callback_query) {
    await decideReview(update.callback_query as ReviewCallback);
    return reply({ ok: true });
  }
  const message = update.message as { chat?: { id?: number; type?: string }; from?: { id?: number }; text?: string } | undefined;
  if (message?.chat?.type !== 'private' || !message.from || !Number.isSafeInteger(message.from.id) || message.chat.id !== message.from.id || typeof message.text !== 'string') return reply({ ok: true });

  const id = String(message.from.id);
  const text = message.text.trim();
  const [command, input] = text.split(/\s+/, 3);
  const isAdmin = admins().includes(id);
  const rows = [[labels.login], [labels.student, labels.teacher], [labels.id, labels.help]];
  if (isAdmin) rows.push(['درخواست‌های ثبت‌نام']);
  const menu: Markup = { keyboard: rows.map((row) => row.map((label) => ({ text: label }))), resize_keyboard: true, is_persistent: true };
  const sendMenu = () => send(id, 'نوع حساب را انتخاب کنید و پس از ارسال فرم منتظر تصمیم مدیر بمانید. اگر حساب دارید، از سایت وارد شوید.', {
    inline_keyboard: [[signupButton('student')], [signupButton('teacher')],
      [{ text: 'ورود از سایت', url: new URL('/#panel', setting('PORTAL_ORIGIN')).href }]],
  });
  try {
    await limit(`telegram:${id}`, 25);
    if (isAdmin && (command === '/requests' || text === 'درخواست‌های ثبت‌نام' || text === labels.inviteStudent || command === '/student')) {
      await pendingReviews(id);
    } else if (command === '/teacher' || text === labels.inviteTeacher) {
      await send(id, 'استاد می‌تواند فرم ساخت حساب را باز کند و درخواستش را برای تأیید مدیر بفرستد.', { inline_keyboard: [[signupButton('teacher')]] });
    } else if (text === labels.student || text === labels.teacher || text === labels.legacyTeacher || (command === '/start' && ['student', 'teacher'].includes(input))) {
      const role = text === labels.teacher || text === labels.legacyTeacher || input === 'teacher' ? 'teacher' : 'student';
      await send(id, 'فرم ساخت حساب را همین‌جا در تلگرام باز کنید.', { inline_keyboard: [[signupButton(role)]] });
    } else if (command === '/panel' || text === labels.login || (command === '/start' && input === 'login')) {
      const [profile] = await query<{ id: string }[]>('portal_profiles', {
        telegram_id: `eq.${id}`, active: 'eq.true', select: 'id', limit: '1',
      });
      await send(id, profile ? 'با نام کاربری و رمز خود وارد شوید.'
        : 'اگر حساب دارید، فرم ورود را باز کنید. برای حساب تازه، از منو گزینهٔ ساخت حساب را بزنید.',
      linkButton('باز کردن فرم ورود', setting('PORTAL_ORIGIN') + '/#panel'));
    } else if (command === '/id' || text === labels.id) {
      await send(id, `شناسهٔ عددی تلگرام شما: ${id}`, menu);
    } else {
      await sendMenu();
      if (isAdmin && command === '/start') await send(id, 'برای دیدن صف استادان و دانشجویان، «درخواست‌های ثبت‌نام» را بزنید.', menu);
    }
  } catch (error) {
    if (error instanceof PortalError && error.status === 429) {
      await send(id, error.message);
    } else throw error;
  }
  return reply({ ok: true });
}

export function eligibleStudent(number: string) {
  return /^[0-9]{6,20}$/.test(number) && number.startsWith(setting('STUDENT_NUMBER_PREFIX'));
}

