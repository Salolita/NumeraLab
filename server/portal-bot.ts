import { digest, equalSecret, limit, PortalError, query, readBody, reply, rpc, setting, studentNumber, token, tokenPattern, write } from './portal-store';

async function send(chatId: string, message: string) {
  const response = await fetch(`https://api.telegram.org/bot${setting('TELEGRAM_BOT_TOKEN')}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: message, link_preview_options: { is_disabled: true } }),
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
  const [command, input, extra] = message.text.trim().split(/\s+/, 3);
  const isAdmin = (process.env.TELEGRAM_ADMIN_IDS ?? '').split(',').map((value) => value.trim()).includes(id);
  try {
    await limit(`telegram:${id}`, 25);
    if ((command === '/teacher' || command === '/student') && isAdmin) {
      const role = command === '/teacher' ? 'teacher' : 'student';
      const number = input ? studentNumber(input) : '';
      if (role === 'student' && !eligibleStudent(number)) {
        await send(id, 'شمارهٔ دانشجویی تأییدشده را پس از دستور /student وارد کنید.');
        return reply({ ok: true });
      }
      const recipient = role === 'teacher' ? input : extra;
      if ((role === 'student' || recipient) && !/^\d{1,16}$/.test(recipient ?? '')) {
        await send(id, 'برای دعوت دانشجو از /student شماره‌دانشجویی شناسه‌تلگرام استفاده کنید. دانشجو شناسهٔ خودش را با /id می‌بیند.');
        return reply({ ok: true });
      }
      const code = token();
      const created = await rpc<boolean>('portal_issue_invite', {
        p_code: digest(code), p_role: role, p_number: role === 'student' ? number : null, p_telegram: recipient || null,
      });
      if (!created) {
        await send(id, 'برای این شمارهٔ دانشجویی یا حساب تلگرام قبلاً حساب ساخته شده است.');
        return reply({ ok: true });
      }
      await send(id, `دعوت یک‌بارمصرف (۴۸ ساعت):\nhttps://t.me/${setting('TELEGRAM_BOT_USERNAME')}?start=${code}`);
    } else if (command === '/start' && tokenPattern.test(input ?? '')) {
      const ticket = token();
      const role = await rpc<string | null>('portal_claim_invite', {
        p_code: digest(input), p_telegram: id, p_ticket: digest(ticket),
      });
      await send(id, role ? `برای ساخت حساب تا ۱۰ دقیقه این لینک را باز کنید:\n${panelLink(ticket, role)}`
        : 'دعوت معتبر نیست یا قبلاً استفاده شده است. از مدیر گروه دعوت بگیرید.');
    } else if (command === '/panel' || command === '/start') {
      const [profile] = await query<{ id: string }[]>('portal_profiles', {
        telegram_id: `eq.${id}`, active: 'eq.true', select: 'id', limit: '1',
      });
      if (!profile) await send(id, 'برای ساخت حساب از لینک دعوتی که مدیر گروه به شما داده استفاده کنید.');
      else {
        const ticket = token();
        await write('portal_tickets', 'POST', { token_hash: digest(ticket), telegram_id: id, profile_id: profile.id });
        await send(id, `لینک یک‌بارمصرف ورود، معتبر تا ۱۰ دقیقه:\n${panelLink(ticket, 'login')}`);
      }
    } else if (command === '/id') {
      await send(id, `شناسهٔ عددی تلگرام شما: ${id}`);
    } else {
      await send(id, 'برای ورود به پنل /panel را بزنید. برای ساخت حساب، لینک دعوت را از مدیر گروه بگیرید.');
    }
  } catch (error) {
    if (error instanceof PortalError && (error.status === 409 || error.status === 429)) {
      await send(id, error.status === 409 ? 'برای این شمارهٔ دانشجویی قبلاً دعوت صادر شده است.' : error.message);
    } else throw error;
  }
  return reply({ ok: true });
}

function panelLink(ticket: string, mode: string) {
  return `${setting('PORTAL_ORIGIN').replace(/\/$/, '')}/#panel/${mode}/${ticket}`;
}

export function eligibleStudent(number: string) {
  return /^[0-9]{6,20}$/.test(number) && number.startsWith(setting('STUDENT_NUMBER_PREFIX'));
}
