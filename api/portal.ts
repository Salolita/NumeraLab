import {
  cookieValue, currentProfile, digest, field, internalEmail, limit, PortalError,
  query, readBody, reply, rpc, setting, studentNumber, supabase, token, tokenPattern, write,
} from '../server/portal-store';
import { eligibleStudent, telegramWebhook } from '../server/portal-bot';
import { quizAction } from '../server/portal-quizzes';

interface Ticket {
  invite_hash: string | null;
  profile_id: string | null;
}

async function activeTicket(raw: string) {
  if (!tokenPattern.test(raw)) throw new PortalError(400, 'لینک معتبر نیست. از ربات لینک تازه بگیرید.');
  const [ticket] = await query<Ticket[]>('portal_tickets', {
    token_hash: `eq.${digest(raw)}`, expires_at: `gt.${new Date().toISOString()}`, select: 'invite_hash,profile_id', limit: '1',
  });
  if (!ticket) throw new PortalError(400, 'لینک منقضی شده یا قبلاً استفاده شده است. از ربات لینک تازه بگیرید.');
  return ticket;
}

export default {
  async fetch(request: Request) {
    try {
      if (request.method === 'GET') {
        const enabled = process.env.PORTAL_ENABLED === 'true';
        return reply({ profile: enabled ? await currentProfile(request) : null, enabled });
      }
      if (request.method !== 'POST') return reply({ error: 'درخواست معتبر نیست.' }, 405);
      const url = new URL(request.url);
      if (setting('PORTAL_ENABLED') !== 'true') throw new PortalError(503, 'سامانهٔ حساب‌ها هنوز راه‌اندازی نشده است.');
      if (url.searchParams.get('telegram') === '1') return await telegramWebhook(request);
      if (request.headers.get('origin') !== setting('PORTAL_ORIGIN')) throw new PortalError(403, 'درخواست معتبر نیست.');
      const body = await readBody(request);
      const action = field(body, 'action');
      if (action === 'logout') {
        const session = cookieValue(request);
        if (session) await write('portal_sessions', 'DELETE', undefined, { token_hash: `eq.${digest(session)}` });
        return reply({ ok: true }, 200, null);
      }
      if (action.startsWith('quiz:')) {
        const profile = await currentProfile(request);
        if (!profile) throw new PortalError(401, 'از ربات وارد پنل شوید.');
        return reply(await quizAction(action, body, profile));
      }
      if (action !== 'register' && action !== 'login') throw new PortalError(400, 'درخواست معتبر نیست.');

      const rawTicket = field(body, 'ticket');
      const ticket = await activeTicket(rawTicket);
      await limit(`ticket:${ticket.profile_id ?? ticket.invite_hash}`, 8);
      const username = field(body, 'username').trim().toLowerCase();
      const password = field(body, 'password');
      if (!/^[a-z0-9][a-z0-9_.-]{2,31}$/.test(username) || password.length < 12 || new TextEncoder().encode(password).length > 72) {
        throw new PortalError(422, 'نام کاربری باید ۳ تا ۳۲ نویسهٔ انگلیسی و رمز عبور ۱۲ نویسه تا ۷۲ بایت باشد.');
      }

      if (action === 'register') {
        if (!ticket.invite_hash) throw new PortalError(400, 'لینک ثبت‌نام معتبر نیست.');
        const [invite] = await query<{ role: string }[]>('portal_invites', {
          code_hash: `eq.${ticket.invite_hash}`, select: 'role', used_at: 'is.null', expires_at: `gt.${new Date().toISOString()}`,
        });
        if (!invite) throw new PortalError(400, 'دعوت معتبر نیست.');
        const first = field(body, 'firstName').trim();
        const last = field(body, 'lastName').trim();
        const number = studentNumber(field(body, 'studentNumber'));
        const date = field(body, 'birthDate');
        const parsedDate = new Date(date + 'T00:00:00Z');
        const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(parsedDate.getTime())
          && parsedDate.toISOString().slice(0, 10) === date && date >= '1900-01-01' && date < new Date().toISOString().slice(0, 10);
        if (!first || !last || first.length > 80 || last.length > 80 ||
          (invite.role === 'student' && (!eligibleStudent(number) || !validDate))) {
          throw new PortalError(422, 'مشخصات ثبت‌نام معتبر نیست. اطلاعات و شرایط دعوت را بررسی کنید.');
        }
        await supabase('/auth/v1/admin/users', 'POST', {
          email: internalEmail(username), password, email_confirm: true,
          app_metadata: { portal_signup: {
            ticket: digest(rawTicket), username, first_name: first, last_name: last,
            student_number: invite.role === 'student' ? number : null, birth_date: invite.role === 'student' ? date : null,
          } },
        });
        return reply({ registered: true });
      }

      if (!ticket.profile_id) throw new PortalError(400, 'از ربات لینک ورود بگیرید.');
      const [expected] = await query<{ id: string }[]>('portal_profiles', {
        id: `eq.${ticket.profile_id}`, username: `eq.${username}`, active: 'eq.true', select: 'id', limit: '1',
      });
      if (!expected) throw new PortalError(401, 'نام کاربری یا رمز عبور معتبر نیست.');
      const auth = await supabase<{ user: { id: string } }>('/auth/v1/token?grant_type=password', 'POST', { email: internalEmail(username), password }, true);
      const session = token();
      if (auth.user.id !== expected.id || !await rpc<boolean>('portal_open_session', {
        p_ticket: digest(rawTicket), p_user: expected.id, p_session: digest(session),
      })) throw new PortalError(401, 'لینک دیگر معتبر نیست. از ربات لینک تازه بگیرید.');
      return reply({ loggedIn: true }, 200, session);
    } catch (error) {
      if (error instanceof PortalError) return reply({ error: error.message }, error.status);
      return reply({ error: 'درخواست انجام نشد. دوباره تلاش کنید.' }, 503);
    }
  },
};
