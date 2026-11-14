import {
  AuthAccountExists, internalEmail, limit, PortalError, query, setting, supabase, uuidPattern, verifyPassword, write,
} from './portal-store.js';

type AccountRole = 'student' | 'teacher';

interface AccountRequest {
  id: string;
  role: AccountRole;
  first_name: string;
  last_name: string;
  student_number: string | null;
  course_name: string | null;
  telegram_id: string | null;
}
export const admins = () => [...new Set(setting('TELEGRAM_ADMIN_IDS').split(',').map((id) => id.trim()).filter((id) => /^[1-9]\d{0,15}$/.test(id)))];
const requestFields = 'id,role,first_name,last_name,student_number,course_name,telegram_id';

type Application = Pick<AccountRequest, 'first_name' | 'last_name' | 'telegram_id'> & { username: string; phone: string } & (
  { role: 'student'; student_number: string; birth_date: string } | { role: 'teacher'; course_name: string }
);

export async function queueAccount(application: Application, password: string) {
  const { username, role } = application;
  let created: { id: string };
  try {
    created = await supabase('/auth/v1/admin/users', 'POST', {
      email: internalEmail(username), password, email_confirm: true,
      app_metadata: { [`portal_${role}_request`]: application },
    });
  } catch (error) {
    if (!(error instanceof AuthAccountExists)) throw error;
    await limit(`login:username:${username}`, 10);
    const id = await verifyPassword(username, password).catch((failure) => {
      if (failure instanceof PortalError && failure.status === 401) {
        throw new PortalError(409, 'این نام کاربری قبلاً ثبت شده است. اگر ثبت‌نام را قبلاً شروع کرده‌اید، همان رمز قبلی را وارد کنید.');
      }
      throw failure;
    });
    const [existing] = await query<{ role: string; review_status: string }[]>('portal_profiles', {
      id: `eq.${id}`, select: 'role,review_status',
    });
    if (existing?.role === role && existing.review_status === 'pending') return null;
    if (existing?.role === role && existing.review_status === 'rejected') {
      throw new PortalError(403, 'درخواست قبلی لغو شده است. برای پیگیری با مدیر گروه تماس بگیرید.');
    }
    if (existing) throw new PortalError(409, 'حساب قبلاً ساخته شده است. از بخش ورود استفاده کنید.');
    // Complete older sign-ups only after proving ownership of the existing credentials.
    const [account] = await write<AccountRequest[]>('portal_profiles', 'POST', {
      id, ...application, active: false, review_status: 'pending',
    }, { select: requestFields });
    return account;
  }
  const [account] = await query<AccountRequest[]>('portal_profiles', { id: `eq.${created.id}`, select: requestFields });
  if (!account) throw new PortalError(503, 'ثبت درخواست کامل نشد. با همان نام کاربری و رمز دوباره تلاش کنید.');
  return account;
}

async function telegram(method: string, body: object) {
  const response = await fetch(`https://api.telegram.org/bot${setting('TELEGRAM_BOT_TOKEN')}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok || !(await response.json()).ok) throw new Error('Telegram delivery failed');
}

function reviewText(account: AccountRequest) {
  const teacher = account.role === 'teacher';
  const detail = teacher ? `نام درس: ${account.course_name}` : `شمارهٔ دانشجویی: ${account.student_number}`;
  return `درخواست حساب ${teacher ? 'استاد' : 'دانشجو'}\nنام: ${account.first_name}\nنام خانوادگی: ${account.last_name}\n${detail}`;
}
function sendReview(chat: string, account: AccountRequest) {
  return telegram('sendMessage', { chat_id: chat, text: reviewText(account), reply_markup: { inline_keyboard: [[
    { text: 'تأیید', callback_data: `approve:${account.id}` },
    { text: 'لغو', callback_data: `reject:${account.id}` },
  ]] } });
}
export async function notifyReview(account: AccountRequest) {
  const deliveries = await Promise.allSettled([
    ...admins().map((id) => sendReview(id, account)),
    ...(account.telegram_id ? [telegram('sendMessage', { chat_id: account.telegram_id,
      text: 'درخواست ثبت‌نام شما دریافت شد و در انتظار تأیید مدیر است.' })] : []),
  ]);
  if (account.telegram_id) deliveries.pop();
  return deliveries.some((delivery) => delivery.status === 'fulfilled');
}
export async function pendingReviews(chat: string) {
  if (!admins().includes(chat)) return;
  const accounts = await query<AccountRequest[]>('portal_profiles', {
    review_status: 'eq.pending', select: requestFields, order: 'requested_at.asc', limit: '10',
  });
  if (!accounts.length) await telegram('sendMessage', { chat_id: chat, text: 'درخواست در انتظار تأیید وجود ندارد.' });
  else for (const account of accounts) await sendReview(chat, account);
}

export interface ReviewCallback {
  id?: string;
  from?: { id?: number };
  data?: string;
  message?: { message_id?: number; chat?: { id?: number; type?: string } };
}
export async function decideReview(callback: ReviewCallback) {
  if (typeof callback.id !== 'string') return;
  const answer = (text: string) => telegram('answerCallbackQuery', { callback_query_id: callback.id, text });
  const [decision, id] = (typeof callback.data === 'string' ? callback.data : '').split(':');
  const chat = callback.message?.chat;
  if (chat?.type !== 'private' || chat.id !== callback.from?.id || !admins().includes(String(chat.id))
    || (decision !== 'approve' && decision !== 'reject') || !uuidPattern.test(id ?? '')) {
    await answer('اجازهٔ انجام این کار را ندارید.');
    return;
  }
  const approved = decision === 'approve';
  const [account] = await write<AccountRequest[]>('portal_profiles', 'PATCH', {
    active: approved, review_status: approved ? 'approved' : 'rejected',
  }, { id: `eq.${id}`, review_status: 'eq.pending', select: requestFields });
  const status = account ? approved ? 'حساب تأیید شد.' : 'درخواست لغو شد.' : 'این درخواست قبلاً بررسی شده است.';
  await Promise.allSettled([
    answer(status),
    telegram('editMessageText', {
      chat_id: chat.id, message_id: callback.message?.message_id,
      text: account ? `${reviewText(account)}\n\n${status}` : status, reply_markup: { inline_keyboard: [] },
    }),
    ...(account?.telegram_id ? [telegram('sendMessage', { chat_id: account.telegram_id,
      text: approved ? 'حسابتان تأیید شد. از سایت وارد شوید.' : 'درخواست حساب لغو شد. برای پیگیری با مدیر گروه تماس بگیرید.',
      ...(approved ? { reply_markup: { inline_keyboard: [[{ text: 'ورود به نامرالب', url: setting('PORTAL_ORIGIN') + '/#panel' }]] } } : {}),
    })] : []),
  ]);
}
