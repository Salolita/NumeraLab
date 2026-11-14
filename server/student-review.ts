import { query, setting, uuidPattern, write } from './portal-store.js';

export interface StudentRequest {
  id: string;
  first_name: string;
  last_name: string;
  student_number: string;
  telegram_id: string | null;
}
export const admins = () => [...new Set(setting('TELEGRAM_ADMIN_IDS').split(',').map((id) => id.trim()).filter((id) => /^[1-9]\d{0,15}$/.test(id)))];
export const studentFields = 'id,first_name,last_name,student_number,telegram_id';

async function telegram(method: string, body: object) {
  const response = await fetch(`https://api.telegram.org/bot${setting('TELEGRAM_BOT_TOKEN')}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok || !(await response.json()).ok) throw new Error('Telegram delivery failed');
}

function reviewText(student: StudentRequest) {
  return `درخواست حساب دانشجو\nنام: ${student.first_name}\nنام خانوادگی: ${student.last_name}\nشمارهٔ دانشجویی: ${student.student_number}`;
}
function sendReview(chat: string, student: StudentRequest) {
  return telegram('sendMessage', { chat_id: chat, text: reviewText(student), reply_markup: { inline_keyboard: [[
    { text: 'تأیید', callback_data: `approve:${student.id}` },
    { text: 'لغو', callback_data: `reject:${student.id}` },
  ]] } });
}
export async function notifyReview(student: StudentRequest) {
  const deliveries = await Promise.allSettled([
    ...admins().map((id) => sendReview(id, student)),
    ...(student.telegram_id ? [telegram('sendMessage', { chat_id: student.telegram_id,
      text: 'درخواست ثبت‌نام شما دریافت شد و در انتظار تأیید مدیر است.' })] : []),
  ]);
  if (student.telegram_id) deliveries.pop();
  return deliveries.some((delivery) => delivery.status === 'fulfilled');
}
export async function pendingReviews(chat: string) {
  if (!admins().includes(chat)) return;
  const students = await query<StudentRequest[]>('portal_profiles', {
    review_status: 'eq.pending', select: studentFields, order: 'requested_at.asc', limit: '10',
  });
  if (!students.length) await telegram('sendMessage', { chat_id: chat, text: 'درخواست در انتظار تأیید وجود ندارد.' });
  else for (const student of students) await sendReview(chat, student);
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
  const [student] = await write<StudentRequest[]>('portal_profiles', 'PATCH', {
    active: approved, review_status: approved ? 'approved' : 'rejected',
  }, { id: `eq.${id}`, role: 'eq.student', review_status: 'eq.pending', select: studentFields });
  const status = student ? approved ? 'حساب تأیید شد.' : 'درخواست لغو شد.' : 'این درخواست قبلاً بررسی شده است.';
  await Promise.allSettled([
    answer(status),
    telegram('editMessageText', {
      chat_id: chat.id, message_id: callback.message?.message_id,
      text: student ? `${reviewText(student)}\n\n${status}` : status, reply_markup: { inline_keyboard: [] },
    }),
    ...(student?.telegram_id ? [telegram('sendMessage', { chat_id: student.telegram_id,
      text: approved ? 'حسابتان تأیید شد. از سایت وارد شوید.' : 'درخواست حساب لغو شد. برای پیگیری با مدیر گروه تماس بگیرید.',
      ...(approved ? { reply_markup: { inline_keyboard: [[{ text: 'ورود به نامرالب', url: setting('PORTAL_ORIGIN') + '/#panel' }]] } } : {}),
    })] : []),
  ]);
}
