import { digest, equalSecret, limit, PortalError, query, readBody, reply, rpc, setting, studentNumber, token, tokenPattern } from './portal-store.js';

const labels = {
  login: 'ورود به پنل', student: 'ساخت حساب دانشجو', teacher: 'فعال‌سازی حساب استاد',
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
  const message = update.message as { chat?: { id?: number; type?: string }; from?: { id?: number }; text?: string } | undefined;
  if (message?.chat?.type !== 'private' || !message.from || !Number.isSafeInteger(message.from.id) || message.chat.id !== message.from.id || typeof message.text !== 'string') return reply({ ok: true });

  const id = String(message.from.id);
  const text = message.text.trim();
  const [command, input, extra, surplus] = text.split(/\s+/, 4);
  const isAdmin = (process.env.TELEGRAM_ADMIN_IDS ?? '').split(',').map((value) => value.trim()).includes(id);
  const rows = [[labels.login], [labels.student, labels.teacher], [labels.id, labels.help]];
  if (isAdmin) rows.push([labels.inviteStudent, labels.inviteTeacher]);
  const menu: Markup = { keyboard: rows.map((row) => row.map((label) => ({ text: label }))), resize_keyboard: true, is_persistent: true };
  const sendMenu = () => send(id, `برای ساخت حساب، نوع حساب را انتخاب کنید. اگر دعوت ندارید، شناسهٔ تلگرام ${id} را به مدیر بدهید. اگر حساب دارید، از سایت وارد شوید.`, {
    inline_keyboard: [[signupButton('student')], [signupButton('teacher')],
      [{ text: 'ورود از سایت', url: new URL('/#panel', setting('PORTAL_ORIGIN')).href }]],
  });
  try {
    await limit(`telegram:${id}`, 25);
    if (command === '/teacher' || command === '/student') {
      if (!isAdmin) {
        await send(id, 'صدور دعوت در اختیار مدیر سامانه است.', menu);
        return reply({ ok: true });
      }
      const role = command === '/teacher' ? 'teacher' : 'student';
      const number = input ? studentNumber(input) : '';
      if (role === 'student' && !eligibleStudent(number)) {
        await send(id, 'شمارهٔ دانشجویی تأییدشده را پس از دستور /student وارد کنید.');
        return reply({ ok: true });
      }
      const recipient = studentNumber((role === 'teacher' ? input : extra) ?? '');
      if (!/^[1-9]\d{0,15}$/.test(recipient) || (role === 'teacher' ? extra : surplus)) {
        await send(id, role === 'teacher' ? 'پس از بررسی هویت استاد، دستور /teacher شناسه‌تلگرام را بفرستید.'
          : 'دستور /student شماره‌دانشجویی شناسه‌تلگرام را بفرستید. دانشجو شناسه‌اش را از منوی ربات می‌گیرد.', menu);
        return reply({ ok: true });
      }
      const code = token();
      const created = await rpc<boolean>('portal_issue_invite', {
        p_code: digest(code), p_role: role, p_number: role === 'student' ? number : null, p_telegram: recipient,
      });
      if (!created) {
        await send(id, 'برای این شمارهٔ دانشجویی یا حساب تلگرام قبلاً حساب ساخته شده است.');
        return reply({ ok: true });
      }
      await send(id, `دعوت برای شناسهٔ ${recipient} ثبت شد و ۴۸ ساعت اعتبار دارد. گیرنده در ربات /start را می‌زند و نوع حساب را انتخاب می‌کند.`, menu);
    } else if (command === '/start' && tokenPattern.test(input ?? '')) {
      const [invite] = await query<{ role: 'student' | 'teacher' }[]>('portal_invites', {
        code_hash: `eq.${digest(input)}`, telegram_id: `eq.${id}`, used_at: 'is.null', expires_at: `gt.${new Date().toISOString()}`,
        select: 'role', limit: '1',
      });
      if (invite) await send(id, 'فرم ساخت حساب را همین‌جا در تلگرام باز کنید.', { inline_keyboard: [[signupButton(invite.role)]] });
      else await sendMenu();
    } else if (text === labels.student || text === labels.teacher || (command === '/start' && ['student', 'teacher'].includes(input))) {
      const role = text === labels.teacher || input === 'teacher' ? 'teacher' : 'student';
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
    } else if (isAdmin && text === labels.inviteStudent) {
      await send(id, 'بعد از تأیید دانشجو، دستور /student شماره‌دانشجویی شناسه‌تلگرام را بفرستید. شناسه از گزینهٔ «شناسهٔ تلگرام من» به دست می‌آید.', menu);
    } else if (isAdmin && text === labels.inviteTeacher) {
      await send(id, 'بعد از تأیید استاد، دستور /teacher شناسه‌تلگرام را بفرستید. دعوت فقط با همان حساب باز می‌شود.', menu);
    } else {
      await sendMenu();
      if (isAdmin && command === '/start') await send(id, 'برای صدور دعوت، از دکمه‌های مدیریت پایین استفاده کنید.', menu);
    }
  } catch (error) {
    if (error instanceof PortalError && (error.status === 409 || error.status === 429)) {
      await send(id, error.status === 409 ? 'برای این شمارهٔ دانشجویی قبلاً دعوت صادر شده است.' : error.message);
    } else throw error;
  }
  return reply({ ok: true });
}

export function eligibleStudent(number: string) {
  return /^[0-9]{6,20}$/.test(number) && number.startsWith(setting('STUDENT_NUMBER_PREFIX'));
}
