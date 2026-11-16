import { equalSecret, limit, PortalError, query, readBody, reply, setting } from './portal-store.js';
import { admins, decideReview, pendingReviews, reviewStatusText, type ReviewCallback } from './account-review.js';
import { telegram } from './telegram-delivery.js';

const labels = {
  home: 'ورود به سایت', solver: 'نامرالب', quizzes: 'آزمون‌ها', student: 'ساخت حساب دانشجو', teacher: 'ساخت حساب استاد',
  status: 'وضعیت حساب و اتصال تلگرام', about: 'درباره ما', sizing: 'انداز برانداز', talent: 'استعدادتو', requests: 'درخواست‌های ثبت‌نام',
};

const link = (text: string, url: string) => ({ text, url });
const miniApp = (text: string, params: string) => ({
  text, web_app: { url: new URL('/register.html?' + params, setting('PORTAL_ORIGIN')).href },
});

function keyboard(chat: string, hasAccount: boolean) {
  const rows = [[labels.home, labels.solver], [labels.quizzes, labels.status]];
  if (!hasAccount) rows.push([labels.student, labels.teacher]);
  rows.push([labels.sizing, labels.talent], [labels.about]);
  if (admins().includes(chat)) rows.push([labels.requests]);
  return { keyboard: rows.map((row) => row.map((text) => ({ text }))), resize_keyboard: true, is_persistent: true };
}

export function refreshPortalMenu(chat: string, hasAccount: boolean) {
  return telegram('sendMessage', { chat_id: chat, text: 'از منو می‌توانید وارد سایت شوید یا سرویس‌ها را انتخاب کنید.',
    reply_markup: keyboard(chat, hasAccount) });
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

  const chat = String(message.from.id);
  const text = message.text.trim();
  const [command, input] = text.split(/\s+/, 2);
  const send = (text: string, reply_markup?: object) => telegram('sendMessage', { chat_id: chat, text, reply_markup, link_preview_options: { is_disabled: true } });
  try {
    await limit(`telegram:${chat}`, 25);
    const [account] = await query<{ active: boolean; review_status: keyof typeof reviewStatusText }[]>('portal_profiles', {
      telegram_id: `eq.${chat}`, select: 'active,review_status', limit: '1',
    });
    const menu = keyboard(chat, Boolean(account));
    const login = async (target: 'home' | 'panel' | 'solver') => {
      if (command === '/start') await refreshPortalMenu(chat, Boolean(account)).catch(() => {});
      const buttons = [miniApp('ورود با مینی‌اپ تلگرام', 'mode=login&to=' + target)];
      const rows = target === 'home' ? [[link(labels.home, 'https://ieaum.ir/')], buttons] : [buttons];
      await send('برای ورود به حساب، مینی‌اپ تلگرام را باز کنید.', { inline_keyboard: rows });
    };
    const signup = async (role: 'student' | 'teacher') => {
      if (account) {
        await send('قبلاً حساب نامرالب ساخته‌اید. از گزینهٔ ورود استفاده کنید.', menu);
        return;
      }
      await send('فرم ساخت حساب را در مینی‌اپ باز کنید.', { inline_keyboard: [[miniApp(labels[role], 'role=' + role)]] });
    };

    if (admins().includes(chat) && (command === '/requests' || text === labels.requests || text === 'دعوت دانشجو' || command === '/student')) {
      await pendingReviews(chat);
    } else if (text === labels.teacher || text === 'فعال‌سازی حساب استاد' || text === 'دعوت استاد' || command === '/teacher' || (command === '/start' && input === 'teacher')) {
      await signup('teacher');
    } else if (text === labels.student || (command === '/start' && input === 'student')) {
      await signup('student');
    } else if (text === labels.home || command === '/site' || (command === '/start' && input === 'home')) {
      await login('home');
    } else if (text === labels.solver || command === '/numralab' || (command === '/start' && input === 'solver')) {
      await login('solver');
    } else if ([labels.quizzes, 'ورود به پنل'].includes(text) || ['/panel', '/quizzes'].includes(command) || (command === '/start' && input === 'login')) {
      await login('panel');
    } else if (text === labels.sizing || text === labels.talent) {
      await send('این سرویس به زودی ارائه می‌شود.', menu);
    } else if (text === labels.about || text === 'راهنما' || command === '/about') {
      await send('دستیار مهندسان صنایع دانشگاه آزاد مشهد', { inline_keyboard: [[link('ورود به کانال تلگرام', 'https://t.me/ieaum_club')]] });
    } else if (command === '/status' || text === labels.status || (command === '/start' && input === 'link')) {
      if (!account) await login('panel');
      else await send(account.review_status === 'approved' && !account.active
        ? 'حساب در حال حاضر غیرفعال است.' : reviewStatusText[account.review_status], menu);
    } else if (command === '/id' || text === 'شناسهٔ تلگرام من') {
      await send(`شناسهٔ عددی تلگرام شما: ${chat}`, menu);
    } else {
      await send('به ربات دستیار مهندسان صنایع خوش آمدید.', menu);
    }
  } catch (error) {
    if (error instanceof PortalError && error.status === 429) await send(error.message);
    else throw error;
  }
  return reply({ ok: true });
}

export function eligibleStudent(number: string) {
  return /^[0-9]{6,20}$/.test(number) && number.startsWith(setting('STUDENT_NUMBER_PREFIX'));
}
