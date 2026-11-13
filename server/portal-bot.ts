import { digest, equalSecret, limit, PortalError, query, readBody, reply, rpc, setting, studentNumber, token, tokenPattern } from './portal-store.js';

const labels = {
  login: 'ورود به پنل', student: 'ساخت حساب دانشجو', teacher: 'فعال‌سازی حساب استاد',
  id: 'شناسهٔ تلگرام من', help: 'راهنما', inviteStudent: 'دعوت دانشجو', inviteTeacher: 'دعوت استاد',
};

type Markup = { keyboard: { text: string }[][]; resize_keyboard: boolean; is_persistent: boolean }
  | { inline_keyboard: { text: string; url: string }[][] };

const linkButton = (text: string, url: string): Markup => ({ inline_keyboard: [[{ text, url }]] });

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
  const sendMenu = () => send(id, 'به ربات نامرالب خوش آمدید. یکی از گزینه‌های پایین را انتخاب کنید. اگر حساب دارید «ورود به پنل» را بزنید. ساخت حساب برای دانشجویان ورودی ۴۰۴ و استادان با دعوت مدیر انجام می‌شود.', menu);
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
      await send(id, `دعوت یک‌بارمصرف برای شناسهٔ ${recipient} ثبت شد و ۴۸ ساعت اعتبار دارد. به گیرنده بگویید از منوی ربات گزینهٔ ساخت حساب را بزند یا همین لینک را برایش بفرستید:\nhttps://t.me/${setting('TELEGRAM_BOT_USERNAME')}?start=${code}`, menu);
    } else if (command === '/start' && tokenPattern.test(input ?? '')) {
      await openRegistration(id, digest(input));
    } else if (text === labels.student || text === labels.teacher || (command === '/start' && ['student', 'teacher'].includes(input))) {
      const role = text === labels.teacher || input === 'teacher' ? 'teacher' : 'student';
      const [invite] = await query<{ code_hash: string }[]>('portal_invites', {
        telegram_id: `eq.${id}`, role: `eq.${role}`, used_at: 'is.null', expires_at: `gt.${new Date().toISOString()}`, select: 'code_hash', order: 'expires_at.desc', limit: '1',
      });
      if (invite) await openRegistration(id, invite.code_hash);
      else await send(id, role === 'student'
        ? `حساب دانشجو ویژهٔ ورودی ۴۰۴ است. شمارهٔ دانشجویی و شناسهٔ تلگرام ${id} را از مسیر مورد اعتماد به مدیر گروه بدهید. بعد از تأیید مدیر، همین گزینه را دوباره بزنید. اگر قبلاً حساب ساخته‌اید «ورود به پنل» را بزنید.`
        : `برای فعال‌سازی حساب، شناسهٔ تلگرام ${id} را به مدیر سامانه بدهید. بعد از صدور دعوت، همین گزینه را دوباره بزنید.`, menu);
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
    }
  } catch (error) {
    if (error instanceof PortalError && (error.status === 409 || error.status === 429)) {
      await send(id, error.status === 409 ? 'برای این شمارهٔ دانشجویی قبلاً دعوت صادر شده است.' : error.message);
    } else throw error;
  }
  return reply({ ok: true });
}

async function openRegistration(id: string, codeHash: string) {
  const ticket = token();
  const role = await rpc<string | null>('portal_claim_invite', {
    p_code: codeHash, p_telegram: id, p_ticket: digest(ticket),
  });
  if (role === 'student' || role === 'teacher') {
    await send(id, 'برای ساخت حساب تا ۱۰ دقیقه دکمه را بزنید. اطلاعات و رمز را فقط در فرم سایت وارد کنید.',
      linkButton('باز کردن فرم ساخت حساب', panelLink(ticket, role)));
  } else {
    await send(id, 'این دعوت معتبر نیست یا قبلاً استفاده شده است. برای حساب موجود /panel را بزنید. برای دعوت تازه با مدیر گروه تماس بگیرید.');
  }
}

function panelLink(ticket: string, mode: string) {
  return `${setting('PORTAL_ORIGIN').replace(/\/$/, '')}/#panel/${mode}/${ticket}`;
}

export function eligibleStudent(number: string) {
  return /^[0-9]{6,20}$/.test(number) && number.startsWith(setting('STUDENT_NUMBER_PREFIX'));
}
